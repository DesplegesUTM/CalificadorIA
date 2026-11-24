'use strict';
const router = require('express').Router();
const { index, showCreate, create, show, showEdit, update } = require('../controllers/activityController');

router.get('/', index);
router.get('/nueva', showCreate);
router.post('/', create);
router.get('/:id', show);
router.get('/:id/editar', showEdit);
router.post('/:id', update);

module.exports = router;
