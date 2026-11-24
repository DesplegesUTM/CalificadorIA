'use strict';

const { prisma } = require('../config/database');

async function showOrCreate(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await prisma.academicActivity.findUnique({
      where: { id: activityId },
      include: { context: true },
    });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });

    res.render('contexts/edit', {
      title: 'Contexto académico',
      activity,
      context: activity.context || {},
      errors: [],
    });
  } catch (err) { next(err); }
}

async function save(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const { description, objectives, instructions, baseText, additionalInfo } = req.body;

    const existing = await prisma.academicContext.findUnique({ where: { activityId } });

    if (existing) {
      await prisma.academicContext.update({
        where: { activityId },
        data: { description, objectives, instructions, baseText, additionalInfo },
      });
    } else {
      await prisma.academicContext.create({
        data: { activityId, description, objectives, instructions, baseText, additionalInfo },
      });
    }

    req.flash('success', 'Contexto académico guardado correctamente');
    res.redirect(`/actividades/${activityId}`);
  } catch (err) { next(err); }
}

module.exports = { showOrCreate, save };
