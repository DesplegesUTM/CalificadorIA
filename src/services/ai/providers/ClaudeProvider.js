'use strict';

const { BaseAIProvider } = require('./BaseAIProvider');
const { logger } = require('../../../utils/logger');

/**
 * Claude Provider - Adaptador para Anthropic Claude
 * Requiere: npm install @anthropic-ai/sdk
 */
class ClaudeProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'claude';
    this.client = null;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this._initClient(config.apiKey);
  }

  _initClient(apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return;

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic.default({ apiKey: key });
    } catch (err) {
      logger.warn('[Claude] Paquete @anthropic-ai/sdk no instalado. Instale con: npm install @anthropic-ai/sdk');
    }
  }

  async evaluate(params) {
    if (!this.client) {
      throw new Error('Claude no está configurado. Instale @anthropic-ai/sdk y configure la API Key.');
    }

    const prompt = this.buildEvaluationPrompt(params);

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const rawText = message.content[0]?.text;
      if (!rawText) throw new Error('Respuesta vacía de Claude');

      let cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      const parsed = JSON.parse(cleaned);
      return this.normalizeResponse(parsed, params.criteria);
    } catch (err) {
      logger.error(`[Claude] Error: ${err.message}`);
      throw new Error(`Error de Claude: ${err.message}`);
    }
  }

  async testConnection() {
    if (!this.client) {
      return { valid: false, message: 'API Key no configurada o paquete @anthropic-ai/sdk no instalado' };
    }
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Responde únicamente: OK' }],
      });
      return { valid: true, message: `Conexión exitosa con Claude (${this.model})` };
    } catch (err) {
      return { valid: false, message: `Error: ${err.message}` };
    }
  }

  async getAvailableModels() {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }
}

module.exports = { ClaudeProvider };
