'use strict';

const { prisma } = require('../config/database');

async function index(req, res, next) {
  try {
    const isAdmin = req.session.user.role === 'ADMIN';
    const subjects = await prisma.subject.findMany({
      where: isAdmin ? {} : { userId: req.session.user.id },
      include: {
        user: { select: { name: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.render('subjects/index', { title: 'Asignaturas', subjects });
  } catch (err) { next(err); }
}

async function showCreate(req, res) {
  res.render('subjects/create', { title: 'Nueva asignatura', errors: [] });
}

async function create(req, res, next) {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.render('subjects/create', { title: 'Nueva asignatura', errors: ['El nombre es requerido'] });

    // Verificar código único si se proporcionó
    if (code) {
      const existing = await prisma.subject.findUnique({ where: { code } });
      if (existing) return res.render('subjects/create', { title: 'Nueva asignatura', errors: ['El código ya existe'] });
    }

    await prisma.subject.create({
      data: { name, code: code || null, description, userId: req.session.user.id },
    });
    req.flash('success', 'Asignatura creada correctamente');
    res.redirect('/asignaturas');
  } catch (err) { next(err); }
}

async function showEdit(req, res, next) {
  try {
    const subject = await prisma.subject.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!subject) return res.status(404).render('errors/404', { title: 'No encontrado' });
    res.render('subjects/edit', { title: 'Editar asignatura', subject, errors: [] });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { name, code, description } = req.body;
    if (!name) return res.render('subjects/edit', { title: 'Editar asignatura', subject: { id, name, code, description }, errors: ['El nombre es requerido'] });

    await prisma.subject.update({ where: { id }, data: { name, code: code || null, description } });
    req.flash('success', 'Asignatura actualizada');
    res.redirect('/asignaturas');
  } catch (err) { next(err); }
}

async function destroy(req, res, next) {
  try {
    await prisma.subject.update({ where: { id: parseInt(req.params.id) }, data: { active: false } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { index, showCreate, create, showEdit, update, destroy };
