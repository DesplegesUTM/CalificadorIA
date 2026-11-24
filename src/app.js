'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const { logger } = require('./utils/logger');
const { sessionConfig } = require('./config/session');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Rutas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const subjectRoutes = require('./routes/subjects');
const activityRoutes = require('./routes/activities');
const contextRoutes = require('./routes/contexts');
const rubricRoutes = require('./routes/rubrics');
const submissionRoutes = require('./routes/submissions');
const evaluationRoutes = require('./routes/evaluations');
const exportRoutes = require('./routes/exports');
const adminRoutes = require('./routes/admin');
const aiConfigRoutes = require('./routes/aiConfig');

const app = express();

// Configuración del motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
// NOTA: Vistas son páginas completas (no express-ejs-layouts)

// Middlewares de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
}));

app.use(cors({ origin: false }));

// Logging HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sesiones
app.use(session(sessionConfig));

// Archivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Evita que la solicitud automática del navegador altere el destino de retorno de inicio de sesión.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Variables locales globales para vistas
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flashMessages = req.session?.flash || [];
  if (req.session?.flash) delete req.session.flash;
  res.locals.currentPath = req.path;
  next();
});

// Función helper para flash messages
app.use((req, res, next) => {
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({ type, message });
  };
  next();
});

// ===================== RUTAS =====================
app.use('/auth', authRoutes);
app.use('/', authMiddleware, dashboardRoutes);
app.use('/asignaturas', authMiddleware, subjectRoutes);
app.use('/actividades', authMiddleware, activityRoutes);
app.use('/contextos', authMiddleware, contextRoutes);
app.use('/rubricas', authMiddleware, rubricRoutes);
app.use('/entregas', authMiddleware, submissionRoutes);
app.use('/evaluaciones', authMiddleware, evaluationRoutes);
app.use('/exportar', authMiddleware, exportRoutes);
app.use('/admin', authMiddleware, adminRoutes);
app.use('/config-ia', authMiddleware, aiConfigRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/dashboard');
  res.redirect('/auth/login');
});

// 404
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Página no encontrada' });
});

// Error handler global
app.use(errorHandler);

module.exports = app;
