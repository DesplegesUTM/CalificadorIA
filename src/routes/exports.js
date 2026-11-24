'use strict';
const router = require('express').Router();
const { exportActivity } = require('../controllers/exportController');

router.get('/actividad/:activityId/excel', exportActivity);

module.exports = router;
