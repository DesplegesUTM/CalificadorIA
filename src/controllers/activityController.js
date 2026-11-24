'use strict';

const { prisma } = require('../config/database');

async function index(req, res, next) {
  try {
    const isAdmin = req.session.user.role === 'ADMIN';
    const { subjectId } = req.query;

    const where = isAdmin ? {} : { userId: req.session.user.id };
    if (subjectId) where.subjectId = parseInt(subjectId);

    const [activities, subjects] = await Promise.all([
      prisma.academicActivity.findMany({
        where,
        include: {
          subject: true,
          user: { select: { name: true } },
          _count: { select: { submissions: true } },
          rubric: { select: { id: true } },
          context: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subject.findMany({
        where: isAdmin ? { active: true } : { userId: req.session.user.id, active: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.render('activities/index', { title: 'Actividades', activities, subjects, selectedSubjectId: subjectId || '' });
  } catch (err) { next(err); }
}

async function showCreate(req, res, next) {
  try {
    const isAdmin = req.session.user.role === 'ADMIN';
    const subjects = await prisma.subject.findMany({
      where: isAdmin ? { active: true } : { userId: req.session.user.id, active: true },
      orderBy: { name: 'asc' },
    });
    res.render('activities/create', { title: 'Nueva actividad', subjects, errors: [] });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { title, description, objectives, instructions, subjectId } = req.body;
    const isAdmin = req.session.user.role === 'ADMIN';

    if (!title || !subjectId) {
      const subjects = await prisma.subject.findMany({
        where: isAdmin ? { active: true } : { userId: req.session.user.id, active: true },
      });
      return res.render('activities/create', {
        title: 'Nueva actividad',
        subjects,
        errors: ['El título y la asignatura son requeridos'],
      });
    }

    const activity = await prisma.academicActivity.create({
      data: {
        title, description, objectives, instructions,
        userId: req.session.user.id,
        subjectId: parseInt(subjectId),
      },
    });

    req.flash('success', 'Actividad creada correctamente');
    res.redirect(`/actividades/${activity.id}`);
  } catch (err) { next(err); }
}

async function show(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const activity = await prisma.academicActivity.findUnique({
      where: { id },
      include: {
        subject: true,
        user: { select: { name: true } },
        context: true,
        rubric: { include: { criteria: { orderBy: { order: 'asc' } } } },
        submissions: {
          include: {
            student: true,
            evaluations: {
              where: { status: 'COMPLETED' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });

    const evaluatedSubmissions = activity.submissions.filter(s => s.evaluations.length > 0);
    const average = evaluatedSubmissions.length
      ? evaluatedSubmissions.reduce((sum, submission) => sum + submission.evaluations[0].percentage, 0) / evaluatedSubmissions.length
      : 0;
    const stats = {
      total: activity.submissions.length,
      evaluated: evaluatedSubmissions.length,
      pending: activity.submissions.length - evaluatedSubmissions.length,
      average: Math.round(average * 10) / 10,
    };

    res.render('activities/show', { title: activity.title, activity, stats });
  } catch (err) { next(err); }
}

async function showEdit(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'ADMIN';
    const [activity, subjects] = await Promise.all([
      prisma.academicActivity.findUnique({ where: { id } }),
      prisma.subject.findMany({
        where: isAdmin ? { active: true } : { userId: req.session.user.id, active: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });
    res.render('activities/edit', { title: 'Editar actividad', activity, subjects, errors: [] });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { title, description, objectives, instructions, subjectId, status } = req.body;
    await prisma.academicActivity.update({
      where: { id },
      data: { title, description, objectives, instructions, subjectId: parseInt(subjectId), status },
    });
    req.flash('success', 'Actividad actualizada');
    res.redirect(`/actividades/${id}`);
  } catch (err) { next(err); }
}

module.exports = { index, showCreate, create, show, showEdit, update };
