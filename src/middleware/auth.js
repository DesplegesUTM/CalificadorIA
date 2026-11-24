'use strict';

function authMiddleware(req, res, next) {
  if (!req.session?.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user || req.session.user.role !== 'ADMIN') {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }
    return res.status(403).render('errors/403', { title: 'Acceso denegado' });
  }
  next();
}

function requireOwnerOrAdmin(model, paramName = 'id') {
  return async (req, res, next) => {
    try {
      const user = req.session.user;
      if (user.role === 'ADMIN') return next();

      const { prisma } = require('../config/database');
      const record = await prisma[model].findUnique({
        where: { id: parseInt(req.params[paramName]) },
      });

      if (!record) return res.status(404).render('errors/404', { title: 'No encontrado' });
      if (record.userId && record.userId !== user.id) {
        return res.status(403).render('errors/403', { title: 'Acceso denegado' });
      }
      req.record = record;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authMiddleware, requireAdmin, requireOwnerOrAdmin };
