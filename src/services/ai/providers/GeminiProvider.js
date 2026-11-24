'use strict';

const { GoogleGenAI } = require('@google/genai');
const { BaseAIProvider } = require('./BaseAIProvider');
const { logger } = require('../../../utils/logger');

class GeminiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.client = null;
    this.model =
      config.model || process.env.GEMINI_MODEL || process.env.GEMINI_MODEL; ///'gemini-3.8-flash'
    this._initClient(config.apiKey);
  }

  _initClient(apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
  }

  async evaluate(params) {
    if (!this.client) {
      throw new Error(
        'Gemini no está configurado. Configure la API Key en Configuración de IA.',
      );
    }

    const prompt = this.buildEvaluationPrompt(params);

    try {
      logger.debug(`[Gemini] Enviando evaluación con modelo ${this.model}`);

      const interaction = await this.client.interactions.create({
        model: this.model,
        input: prompt,
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: {
            type: 'object',
            properties: {
              criteria: {
                type: 'object',
                properties: Object.fromEntries(params.criteria.map(criterion => [
                  criterion.name,
                  {
                    type: 'object',
                    properties: {
                      score: { type: 'number', minimum: 0, maximum: criterion.maxScore },
                      justification: { type: 'string' },
                      strengths: { type: 'string' },
                      weaknesses: { type: 'string' },
                    },
                    required: ['score', 'justification', 'strengths', 'weaknesses'],
                  },
                ])),
                required: params.criteria.map(criterion => criterion.name),
              },
              totalScore: { type: 'number' },
              feedback: { type: 'string' },
              strengths: { type: 'string' },
              weaknesses: { type: 'string' },
              recommendations: { type: 'string' },
            },
            required: ['criteria', 'totalScore', 'feedback', 'strengths', 'weaknesses', 'recommendations'],
          },
        },
        generation_config: {
          max_output_tokens: 16384,
        },
      });

      const rawText = interaction.output_text;
      if (!rawText) throw new Error('La respuesta de Gemini está vacía');

      const parsed = this._parseJSON(rawText);
      return this.normalizeResponse(parsed, params.criteria);
    } catch (err) {
      logger.error(`[Gemini] Error en evaluación: ${err.message}`);
      throw new Error(`Error de Gemini: ${err.message}`);
    }
  }

  async testConnection() {
    if (!this.client) {
      return { valid: false, message: 'API Key no configurada' };
    }

    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: 'Responde únicamente: OK',
        store: false,
      });
      const response = interaction.output_text || '';
      return {
        valid: true,
        message: `Conexión exitosa con Gemini (${this.model}). Respuesta: ${response.substring(0, 50)}`,
      };
    } catch (err) {
      return { valid: false, message: `Error de conexión: ${err.message}` };
    }
  }

  async getAvailableModels() {
    return [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
    ];
  }

  _parseJSON(text) {
    // Intentar limpiar el texto de posibles envolturas markdown
    let cleaned = text.trim();

    // Remover bloques de código markdown
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '');

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Intento de extracción por regex
      const match = cleaned.match(/\{[\s\S]+\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e2) {
          throw new Error(
            `No se pudo parsear la respuesta JSON de Gemini: ${text.substring(0, 200)}`,
          );
        }
      }
      throw new Error(
        `Respuesta inválida de Gemini: ${text.substring(0, 200)}`,
      );
    }
  }
}

module.exports = { GeminiProvider };
