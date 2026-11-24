'use strict';

/**
 * BaseAIProvider - Contrato que todos los proveedores deben implementar
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Evaluar un documento de estudiante
   * @param {Object} params
   * @param {string} params.documentText - Texto del documento a evaluar
   * @param {Object} params.context - Contexto académico
   * @param {Array}  params.criteria - Criterios de la rúbrica
   * @returns {Promise<NormalizedEvaluationResponse>}
   */
  async evaluate(params) {
    throw new Error('El método evaluate() debe ser implementado por el proveedor');
  }

  /**
   * Verificar que la API key y conexión sean válidas
   * @returns {Promise<{valid: boolean, message: string}>}
   */
  async testConnection() {
    throw new Error('El método testConnection() debe ser implementado por el proveedor');
  }

  /**
   * Obtener modelos disponibles
   * @returns {Promise<string[]>}
   */
  async getAvailableModels() {
    return [];
  }

  /**
   * Normalizar la respuesta JSON de la IA al formato estándar
   * @param {Object} raw - Respuesta cruda del modelo
   * @param {Array} criteria - Lista de criterios de la rúbrica
   * @returns {NormalizedEvaluationResponse}
   */
  normalizeResponse(raw, criteria) {
    const criterionScores = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const criterion of criteria) {
      const rawScore = raw.criteria?.[criterion.name] || raw.criterios?.[criterion.name] || {};
      const score = Math.min(parseFloat(rawScore.score ?? rawScore.puntuacion ?? 0), criterion.maxScore);
      
      criterionScores.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        score: isNaN(score) ? 0 : score,
        maxScore: criterion.maxScore,
        justification: rawScore.justification || rawScore.justificacion || '',
        strengths: rawScore.strengths || rawScore.fortalezas || '',
        weaknesses: rawScore.weaknesses || rawScore.debilidades || '',
      });

      totalScore += isNaN(score) ? 0 : score;
      maxScore += criterion.maxScore;
    }

    // Si la IA devolvió puntuación total, usarla como referencia
    const aiTotal = parseFloat(raw.totalScore || raw.puntuacion_total || totalScore);
    
    return {
      criterionScores,
      totalScore: Math.min(totalScore, maxScore),
      maxScore,
      percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
      feedback: raw.feedback || raw.retroalimentacion || raw.retroalimentación || '',
      strengths: raw.strengths || raw.fortalezas || '',
      weaknesses: raw.weaknesses || raw.debilidades || '',
      recommendations: raw.recommendations || raw.recomendaciones || '',
    };
  }

  /**
   * Construir el prompt de evaluación estándar
   */
  buildEvaluationPrompt(params) {
    const { documentText, context, criteria } = params;

    const criteriaText = criteria.map((c, i) => `
${i + 1}. ${c.name} (Puntuación máxima: ${c.maxScore})
   Descripción: ${c.description || 'No especificada'}
   ${c.levels ? `Niveles: ${JSON.stringify(JSON.parse(c.levels || '[]'))}` : ''}`).join('\n');

    return `Eres un evaluador académico experto. Debes evaluar el siguiente trabajo de estudiante de forma objetiva y detallada.

## CONTEXTO ACADÉMICO
Actividad: ${context.activityTitle || 'No especificada'}
Descripción: ${context.description || 'No especificada'}
Objetivos de aprendizaje: ${context.objectives || 'No especificados'}
Instrucciones originales: ${context.instructions || 'No especificadas'}
${context.baseText ? `\nTexto base de referencia:\n${context.baseText}` : ''}
${context.additionalInfo ? `\nInformación complementaria:\n${context.additionalInfo}` : ''}

## RÚBRICA DE EVALUACIÓN
${criteriaText}

## TRABAJO DEL ESTUDIANTE
${documentText}

## INSTRUCCIONES DE EVALUACIÓN
Evalúa el trabajo según cada criterio de la rúbrica. Sé específico, justo y constructivo.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "criteria": {
    ${criteria.map(c => `"${c.name}": {
      "score": <número entre 0 y ${c.maxScore}>,
      "justification": "<justificación detallada de la puntuación>",
      "strengths": "<fortalezas identificadas en este criterio>",
      "weaknesses": "<debilidades identificadas en este criterio>"
    }`).join(',\n    ')}
  },
  "totalScore": <suma de todas las puntuaciones>,
  "feedback": "<retroalimentación general del trabajo>",
  "strengths": "<fortalezas generales del trabajo>",
  "weaknesses": "<debilidades generales del trabajo>",
  "recommendations": "<recomendaciones específicas para mejorar>"
}

IMPORTANTE: 
- Responde SOLO con JSON válido, sin markdown, sin explicaciones previas.
- Las puntuaciones deben ser números decimales entre 0 y el máximo de cada criterio.
- Sé específico y referencia partes concretas del texto en las justificaciones.`;
  }
}

module.exports = { BaseAIProvider };
