'use strict';
const router = require('express').Router();
const { showOrCreate, save, saveAPI } = require('../controllers/rubricController');

router.get('/actividad/:activityId', showOrCreate);
router.post('/actividad/:activityId', save);
router.post('/api/actividad/:activityId', saveAPI);

module.exports = router;
