'use strict';
const router = require('express').Router();
const { uploadZIPorPDF } = require('../middleware/upload');
const { index, showUpload, upload, confirmImport, destroy } = require('../controllers/submissionController');

router.get('/actividad/:activityId', index);
router.get('/actividad/:activityId/subir', showUpload);
router.post('/actividad/:activityId/subir', uploadZIPorPDF.single('file'), upload);
router.post('/actividad/:activityId/confirmar', confirmImport);
router.delete('/:id', destroy);

module.exports = router;
