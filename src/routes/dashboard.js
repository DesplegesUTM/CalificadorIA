'use strict';
const router = require('express').Router();
const { index } = require('../controllers/dashboardController');

router.get('/dashboard', index);

module.exports = router;
