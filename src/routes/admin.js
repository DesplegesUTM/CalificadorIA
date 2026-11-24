'use strict';
const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const {
  listUsers, createUser, toggleUser, resetPassword,
  listAIConfigs, saveAIConfig, testAIConnection, deleteAIConfig,
} = require('../controllers/adminController');

router.use(requireAdmin);

router.get('/usuarios', listUsers);
router.post('/usuarios', createUser);
router.patch('/usuarios/:id/toggle', toggleUser);
router.patch('/usuarios/:id/password', resetPassword);

router.get('/configuracion-ia', listAIConfigs);
router.post('/configuracion-ia', saveAIConfig);
router.post('/configuracion-ia/test', testAIConnection);
router.delete('/configuracion-ia/:id', deleteAIConfig);

module.exports = router;
