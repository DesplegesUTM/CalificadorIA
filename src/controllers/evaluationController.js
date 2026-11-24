'use strict';

const { randomUUID } = require('crypto');
const { prisma } = require('../config/database');
const { evaluateSubmission, evaluateBatch } = require('../services/evaluation/evaluationService');
const { logger } = require('../utils/logger');

const batchJobs = new Map();

async function index(req, res, next) {
  try {
    const activityId = req.query.activityId ? parseInt(req.query.activityId) : undefined;
    const isAdmin = req.session.user.role === 'ADMIN';

    const evaluations = await prisma.evaluation.findMany({
      where: {
        status: 'COMPLETED',
        ...(activityId ? { submission: { activityId } } : {}),
        ...(isAdmin ? {} : { submission: { activity: { userId: req.session.user.id } } }),
      },
      include: {
        submission: {
          include: {
            student: true,
            activity: { include: { subject: true } },
          },
        },
        criterionScores: { include: { criterion: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.render('evaluations/index', { title: 'Evaluaciones', evaluations, activityId });
  } catch (err) { next(err); }
}

async function show(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            student: true,
            activity: { include: { subject: true, rubric: { include: { criteria: true } } } },
          },
        },
        criterionScores: { include: { criterion: true } },
      },
    });
    if (!evaluation) return res.status(404).render('errors/404', { title: 'No encontrado' });
    const isAdmin = req.session.user.role === 'ADMIN';
    const isOwner = evaluation.submission.activity.userId === req.session.user.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).render('errors/403', { title: 'Acceso denegado' });
    }
    res.render('evaluations/show', { title: 'Resultado de evaluación', evaluation });
  } catch (err) { next(err); }
}

async function evaluate(req, res) {
  const submissionId = parseInt(req.params.submissionId);
  
  try {
    const evaluation = await evaluateSubmission(submissionId);
    res.json({ success: true, evaluationId: evaluation.id, totalScore: evaluation.totalScore });
  } catch (err) {
    logger.error(`[EvaluationController] Error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function evaluateBulk(req, res) {
  const { submissionIds } = req.body || {};
  
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Debe seleccionar al menos una entrega' });
  }

  const ids = [...new Set(submissionIds.map(Number))];
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ success: false, error: 'La lista contiene identificadores de entregas inválidos' });
  }

  const now = Date.now();
  for (const [id, job] of batchJobs) {
    if (job.status !== 'processing' && now - job.createdAt > 30 * 60 * 1000) {
      batchJobs.delete(id);
    }
  }

  const jobId = randomUUID();
  const job = {
    userId: req.session.user.id,
    status: 'processing',
    current: 0,
    total: ids.length,
    currentSubmissionId: null,
    success: 0,
    failed: 0,
    createdAt: now,
  };
  batchJobs.set(jobId, job);

  evaluateBatch(ids, (progress) => {
    job.current = progress.current;
    job.currentSubmissionId = progress.status === 'processing' ? progress.submissionId : null;
    if (progress.status === 'completed') job.success++;
    if (progress.status === 'failed') job.failed++;
    logger.debug(`[Batch] Progreso: ${progress.current}/${progress.total} (${progress.status})`);
  }).then(results => {
    job.status = 'completed';
    job.success = results.success.length;
    job.failed = results.failed.length;
    job.current = job.total;
    job.currentSubmissionId = null;
    logger.info(`[Batch] Completado: ${results.success.length} ok, ${results.failed.length} errores`);
  }).catch(err => {
    job.status = 'failed';
    job.error = err.message;
    logger.error(`[Batch] Error general: ${err.message}`);
  });

  res.json({ success: true, message: `Evaluación masiva iniciada para ${ids.length} entregas`, jobId });
}

function getBatchStatus(req, res) {
  const job = batchJobs.get(req.params.jobId);
  if (!job || (job.userId !== req.session.user.id && req.session.user.role !== 'ADMIN')) {
    return res.status(404).json({ success: false, error: 'No se encontró el proceso de evaluación' });
  }

  res.json({
    success: true,
    status: job.status,
    current: job.current,
    total: job.total,
    currentSubmissionId: job.currentSubmissionId,
    completed: job.success + job.failed,
    succeeded: job.success,
    failed: job.failed,
    ...(job.error ? { error: job.error } : {}),
  });
}

async function reevaluate(req, res) {
  const submissionId = parseInt(req.params.submissionId);
  
  try {
    const evaluation = await evaluateSubmission(submissionId);
    res.json({ success: true, evaluationId: evaluation.id, message: 'Re-evaluación completada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { index, show, evaluate, evaluateBulk, getBatchStatus, reevaluate };
