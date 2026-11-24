'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { aiProviderManager } = require('../services/ai/AIProviderManager');

// ========== USUARIOS ==========
async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.render('administration/users', { title: 'Gestión de usuarios', users, errors: [], success: null });
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      const users = await prisma.user.findMany();
      return res.render('administration/users', {
        title: 'Gestión de usuarios', users,
        errors: ['Nombre, email y contraseña son requeridos'], success: null,
      });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      const users = await prisma.user.findMany();
      return res.render('administration/users', {
        title: 'Gestión de usuarios', users,
        errors: ['El email ya está registrado'], success: null,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashedPassword, role: role || 'TEACHER' },
    });

    req.flash('success', 'Usuario creado correctamente');
    res.redirect('/admin/usuarios');
  } catch (err) { next(err); }
}

async function toggleUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: 'No encontrado' });
    if (id === req.session.user.id) return res.status(400).json({ success: false, error: 'No puede desactivarse a sí mismo' });

    await prisma.user.update({ where: { id }, data: { active: !user.active } });
    res.json({ success: true, active: !user.active });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function resetPassword(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ========== CONFIGURACIÓN IA ==========
async function listAIConfigs(req, res, next) {
  try {
    const configs = await prisma.aIProviderConfiguration.findMany({ orderBy: { createdAt: 'asc' } });
    res.render('administration/ai-config', {
      title: 'Configuración de IA',
      configs,
      errors: [],
    });
  } catch (err) { next(err); }
}

async function saveAIConfig(req, res, next) {
  try {
    const { id, name, provider, apiKey, model, isDefault } = req.body;
    const isDefaultBool = isDefault === 'on' || isDefault === true || isDefault === 'true';

    // Si se establece como default, desactivar los demás
    if (isDefaultBool) {
      await prisma.aIProviderConfiguration.updateMany({ data: { isDefault: false } });
    }

    const data = {
      name, provider, model, isDefault: isDefaultBool, isActive: true,
      ...(apiKey && apiKey !== '***' ? { apiKey } : {}),
    };

    if (id) {
      await prisma.aIProviderConfiguration.update({ where: { id: parseInt(id) }, data });
    } else {
      await prisma.aIProviderConfiguration.create({ data });
    }

    req.flash('success', 'Configuración de IA guardada');
    res.redirect('/admin/configuracion-ia');
  } catch (err) { next(err); }
}

async function testAIConnection(req, res) {
  try {
    const { provider, apiKey, model } = req.body;
    let resolvedApiKey = apiKey;
    let resolvedModel = model;
    if (!resolvedApiKey || resolvedApiKey === '***') {
      const saved = await prisma.aIProviderConfiguration.findFirst({
        where: { provider },
        orderBy: { updatedAt: 'desc' },
      });
      resolvedApiKey = saved?.apiKey || undefined;
      resolvedModel = model || saved?.model || undefined;
    }
    const result = await aiProviderManager.testProvider(provider, {
      apiKey: resolvedApiKey,
      model: resolvedModel,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ valid: false, message: err.message });
  }
}

async function deleteAIConfig(req, res) {
  try {
    await prisma.aIProviderConfiguration.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listUsers, createUser, toggleUser, resetPassword, listAIConfigs, saveAIConfig, testAIConnection, deleteAIConfig };
