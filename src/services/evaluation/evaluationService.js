'use strict';

const { prisma } = require('../../config/database');
const { aiProviderManager } = require('../ai/AIProviderManager');
const { sanitizeText } = require('../documents/documentService');
const { logger } = require('../../utils/logger');

/**
 * Servicio principal de evaluación académica con IA
 */

/**
 * Evaluar una entrega individual
 */
async function evaluateSubmission(submissionId) {
  logger.info(`[EvaluationService] Iniciando evaluación de entrega #${submissionId}`);

  // Cargar la entrega con toda la info necesaria
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: true,
      activity: {
        include: {
          context: true,
          rubric: { include: { criteria: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  });

  if (!submission) throw new Error(`Entrega #${submissionId} no encontrada`);
  if (!submission.textContent || submission.textContent.trim().length < 10) {
    throw new Error('El documento no tiene texto suficiente para evaluar. Verifique que el PDF sea legible.');
  }
  if (!submission.activity.rubric) {
    throw new Error('La actividad no tiene una rúbrica configurada. Configure la rúbrica antes de evaluar.');
  }
  if (submission.activity.rubric.criteria.length === 0) {
    throw new Error('La rúbrica no tiene criterios definidos. Agregue criterios a la rúbrica.');
  }

  const context = submission.activity.context || {};
  const criteria = submission.activity.rubric.criteria;

  // Marcar como en progreso
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'EVALUATED' },
  });

  try {
    // Llamar al gestor de IA
    const evaluationResult = await aiProviderManager.evaluate({
      documentText: sanitizeText(submission.textContent),
      context: {
        activityTitle: submission.activity.title,
        description: context.description,
        objectives: context.objectives,
        instructions: context.instructions,
        baseText: context.baseText,
        additionalInfo: context.additionalInfo,
      },
      criteria: criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxScore: c.maxScore,
        levels: c.levels,
      })),
    });

    // Guardar evaluación en BD
    const evaluation = await prisma.evaluation.create({
      data: {
        submissionId,
        totalScore: evaluationResult.totalScore,
        maxScore: evaluationResult.maxScore,
        percentage: evaluationResult.percentage,
        feedback: evaluationResult.feedback,
        strengths: evaluationResult.strengths,
        weaknesses: evaluationResult.weaknesses,
        recommendations: evaluationResult.recommendations,
        aiProvider: evaluationResult.providerName,
        aiModel: evaluationResult.modelName,
        status: 'COMPLETED',
        criterionScores: {
          create: evaluationResult.criterionScores.map(cs => ({
            criterionId: cs.criterionId,
            score: cs.score,
            maxScore: cs.maxScore,
            justification: cs.justification,
            strengths: cs.strengths,
            weaknesses: cs.weaknesses,
          })),
        },
      },
      include: { criterionScores: true },
    });

    logger.info(`[EvaluationService] Evaluación #${evaluation.id} completada. Nota: ${evaluationResult.totalScore}/${evaluationResult.maxScore}`);
    return evaluation;
  } catch (err) {
    // Marcar error
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'ERROR' },
    });

    await prisma.evaluation.create({
      data: {
        submissionId,
        totalScore: 0,
        maxScore: submission.activity.rubric.totalScore || 0,
        percentage: 0,
        feedback: `Error durante la evaluación: ${err.message}`,
        status: 'FAILED',
      },
    });

    throw err;
  }
}

/**
 * Evaluación masiva de entregas
 */
async function evaluateBatch(submissionIds, progressCallback) {
  const results = { success: [], failed: [] };

  for (let i = 0; i < submissionIds.length; i++) {
    const id = submissionIds[i];
    
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: submissionIds.length,
        submissionId: id,
        status: 'processing',
      });
    }

    try {
      const evaluation = await evaluateSubmission(id);
      results.success.push({ submissionId: id, evaluationId: evaluation.id });
    } catch (err) {
      logger.error(`[EvaluationService] Error en entrega #${id}: ${err.message}`);
      results.failed.push({ submissionId: id, error: err.message });
    }

    // Pequeña pausa para evitar rate limiting
    if (i < submissionIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Obtener estadísticas de evaluaciones de una actividad
 */
async function getActivityStats(activityId) {
  const submissions = await prisma.submission.findMany({
    where: { activityId },
    include: {
      evaluations: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const total = submissions.length;
  const evaluated = submissions.filter(s => s.evaluations.length > 0).length;
  const pending = total - evaluated;
  const scores = submissions
    .filter(s => s.evaluations.length > 0)
    .map(s => s.evaluations[0].percentage);
  const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return { total, evaluated, pending, average: Math.round(average * 10) / 10 };
}

module.exports = { evaluateSubmission, evaluateBatch, getActivityStats };
