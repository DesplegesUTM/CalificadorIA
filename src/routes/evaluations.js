'use strict';
const router = require('express').Router();
const { index, show, evaluate, evaluateBulk, getBatchStatus, reevaluate } = require('../controllers/evaluationController');

router.get('/', index);
router.get('/lote/:jobId', getBatchStatus);
router.get('/:id', show);
router.post('/evaluar/:submissionId', evaluate);
router.post('/evaluar-lote', evaluateBulk);
router.post('/reevaluar/:submissionId', reevaluate);

module.exports = router;
