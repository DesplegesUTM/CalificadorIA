'use strict';

const { prisma } = require('../config/database');
const { evaluateSubmission, evaluateBatch } = require('../services/evaluation/evaluationService');
const { logger } = require('../utils/logger');

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
  const { submissionIds } = req.body;
  
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Debe seleccionar al menos una entrega' });
  }

  // Responder inmediatamente con jobId para progreso en tiempo real via SSE
  const jobId = Date.now().toString();
  
  // Ejecutar en background
  evaluateBatch(submissionIds.map(Number), (progress) => {
    logger.debug(`[Batch] Progreso: ${progress.current}/${progress.total}`);
  }).then(results => {
    logger.info(`[Batch] Completado: ${results.success.length} ok, ${results.failed.length} errores`);
  }).catch(err => {
    logger.error(`[Batch] Error general: ${err.message}`);
  });

  res.json({ success: true, message: `Evaluación masiva iniciada para ${submissionIds.length} entregas`, jobId });
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

module.exports = { index, show, evaluate, evaluateBulk, reevaluate };
