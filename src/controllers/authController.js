'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');

async function showLogin(req, res) {
  if (req.session?.user) return res.redirect('/dashboard');
  res.render('auth/login', {
    title: 'Iniciar sesión',
    error: null,
    success: req.query.registered === '1' ? 'Cuenta creada. Ya puedes iniciar sesión.' : null,
  });
}

async function showRegister(req, res) {
  if (req.session?.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Crear cuenta', error: null, name: '', email: '' });
}

async function register(req, res) {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  const renderRegisterError = (error, status = 400) => res.status(status).render('auth/register', {
    title: 'Crear cuenta',
    error,
    name,
    email,
  });

  if (!name || !email || !password || !confirmPassword) {
    return renderRegisterError('Todos los campos son obligatorios');
  }

  if (name.length > 120) {
    return renderRegisterError('El nombre no puede superar los 120 caracteres');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return renderRegisterError('Ingresa un correo electrónico válido');
  }

  if (password.length < 6) {
    return renderRegisterError('La contraseña debe tener al menos 6 caracteres');
  }

  if (password !== confirmPassword) {
    return renderRegisterError('Las contraseñas no coinciden');
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return renderRegisterError('Ya existe una cuenta con ese correo electrónico', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'TEACHER' },
    });

    logger.info(`[Auth] Registro exitoso: ${email}`);
    return res.redirect('/auth/login?registered=1');
  } catch (err) {
    if (err.code === 'P2002') {
      return renderRegisterError('Ya existe una cuenta con ese correo electrónico', 409);
    }

    logger.error(`[Auth] Error en registro: ${err.message}`);
    return renderRegisterError('Error interno. Intenta nuevamente.', 500);
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('auth/login', { title: 'Iniciar sesión', error: 'Email y contraseña son requeridos' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    
    if (!user || !user.active) {
      return res.render('auth/login', { title: 'Iniciar sesión', error: 'Credenciales incorrectas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('auth/login', { title: 'Iniciar sesión', error: 'Credenciales incorrectas' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    logger.info(`[Auth] Login exitoso: ${user.email}`);
    
    const returnTo = req.session.returnTo === '/favicon.ico'
      ? '/dashboard'
      : req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (err) {
    logger.error(`[Auth] Error en login: ${err.message}`);
    return res.render('auth/login', { title: 'Iniciar sesión', error: 'Error interno. Intente nuevamente.' });
  }
}

async function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('evaluadoria.sid');
    res.redirect('/auth/login');
  });
}

module.exports = { showLogin, login, showRegister, register, logout };
