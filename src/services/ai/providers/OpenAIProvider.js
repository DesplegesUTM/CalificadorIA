'use strict';

const { BaseAIProvider } = require('./BaseAIProvider');
const { logger } = require('../../../utils/logger');

/**
 * OpenAI Provider - Adaptador para GPT-4o y otros modelos de OpenAI
 * Requiere: npm install openai
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    this.client = null;
    this.model = config.model || 'gpt-4o';
    this._initClient(config.apiKey);
  }

  _initClient(apiKey) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) return;

    try {
      const { OpenAI } = require('openai');
      this.client = new OpenAI({ apiKey: key });
    } catch (err) {
      logger.warn('[OpenAI] Paquete openai no instalado. Instale con: npm install openai');
    }
  }

  async evaluate(params) {
    if (!this.client) {
      throw new Error('OpenAI no está configurado. Instale el paquete openai y configure la API Key.');
    }

    const prompt = this.buildEvaluationPrompt(params);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const rawText = response.choices[0]?.message?.content;
      if (!rawText) throw new Error('Respuesta vacía de OpenAI');

      const parsed = JSON.parse(rawText);
      return this.normalizeResponse(parsed, params.criteria);
    } catch (err) {
      logger.error(`[OpenAI] Error: ${err.message}`);
      throw new Error(`Error de OpenAI: ${err.message}`);
    }
  }

  async testConnection() {
    if (!this.client) {
      return { valid: false, message: 'API Key no configurada o paquete openai no instalado' };
    }
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Responde únicamente: OK' }],
        max_tokens: 10,
      });
      return { valid: true, message: `Conexión exitosa con OpenAI (${this.model})` };
    } catch (err) {
      return { valid: false, message: `Error: ${err.message}` };
    }
  }

  async getAvailableModels() {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  }
}

module.exports = { OpenAIProvider };
