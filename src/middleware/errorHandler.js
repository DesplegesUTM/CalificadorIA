'use strict';

const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${err.message}\n${err.stack}`);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Error interno del servidor';

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    });
  }

  if (statusCode === 404) {
    return res.status(404).render('errors/404', { title: 'Página no encontrada' });
  }

  res.status(statusCode).render('errors/500', {
    title: 'Error del servidor',
    error: process.env.NODE_ENV === 'development' ? message : 'Ha ocurrido un error. Por favor intente nuevamente.',
  });
}

function createError(message, statusCode = 500) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
