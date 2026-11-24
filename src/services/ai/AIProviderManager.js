'use strict';

const { GeminiProvider } = require('./providers/GeminiProvider');
const { OpenAIProvider } = require('./providers/OpenAIProvider');
const { ClaudeProvider } = require('./providers/ClaudeProvider');
const { logger } = require('../../utils/logger');

const PROVIDER_MAP = {
  GEMINI: GeminiProvider,
  OPENAI: OpenAIProvider,
  CLAUDE: ClaudeProvider,
};

class AIProviderManager {
  constructor() {
    this._activeProvider = null;
    this._providerCache = new Map();
  }

  /**
   * Obtener el proveedor activo desde la BD o variable de entorno
   */
  async getActiveProvider() {
    try {
      const { prisma } = require('../../config/database');
      const config = await prisma.aIProviderConfiguration.findFirst({
        where: { isDefault: true, isActive: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (config && config.apiKey) {
        return this._buildProvider(config.provider, {
          apiKey: config.apiKey,
          model: config.model,
        });
      }
    } catch (err) {
      logger.warn(`[AIProviderManager] Error al obtener config de BD: ${err.message}`);
    }

    // Fallback a variables de entorno (Gemini)
    if (process.env.GEMINI_API_KEY) {
      return this._buildProvider('GEMINI', {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      });
    }

    throw new Error('No hay ningún proveedor de IA configurado. Configure una API Key en el panel de administración.');
  }

  /**
   * Obtener un proveedor específico por nombre
   */
  async getProvider(providerName, config = {}) {
    return this._buildProvider(providerName.toUpperCase(), config);
  }

  /**
   * Evaluar un documento usando el proveedor activo
   */
  async evaluate(params) {
    const provider = await this.getActiveProvider();
    logger.info(`[AIProviderManager] Evaluando con proveedor: ${provider.name}, modelo: ${provider.model}`);
    
    const result = await provider.evaluate(params);
    result.providerName = provider.name;
    result.modelName = provider.model;
    return result;
  }

  /**
   * Probar la conexión de un proveedor específico
   */
  async testProvider(providerName, config) {
    const provider = this._buildProvider(providerName.toUpperCase(), config);
    return provider.testConnection();
  }

  /**
   * Obtener modelos disponibles para un proveedor
   */
  async getModels(providerName, config = {}) {
    const provider = this._buildProvider(providerName.toUpperCase(), config);
    return provider.getAvailableModels();
  }

  _buildProvider(providerName, config) {
    const ProviderClass = PROVIDER_MAP[providerName];
    if (!ProviderClass) {
      throw new Error(`Proveedor de IA no reconocido: ${providerName}`);
    }
    return new ProviderClass(config);
  }
}

// Singleton
const aiProviderManager = new AIProviderManager();

module.exports = { aiProviderManager, AIProviderManager };
