'use strict';
const router = require('express').Router();
const { showOrCreate, save } = require('../controllers/contextController');

router.get('/actividad/:activityId', showOrCreate);
router.post('/actividad/:activityId', save);

module.exports = router;
