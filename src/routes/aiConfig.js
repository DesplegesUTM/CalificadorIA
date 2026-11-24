'use strict';
const router = require('express').Router();
const { listAIConfigs, saveAIConfig, testAIConnection } = require('../controllers/adminController');

// Redirección a la sección admin para docentes
router.get('/', (req, res) => res.redirect('/admin/configuracion-ia'));

module.exports = router;
