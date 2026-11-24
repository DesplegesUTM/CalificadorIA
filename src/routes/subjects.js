'use strict';
const router = require('express').Router();
const { index, showCreate, create, showEdit, update, destroy } = require('../controllers/subjectController');

router.get('/', index);
router.get('/nueva', showCreate);
router.post('/', create);
router.get('/:id/editar', showEdit);
router.post('/:id', update);
router.delete('/:id', destroy);

module.exports = router;
