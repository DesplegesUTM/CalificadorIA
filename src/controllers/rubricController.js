'use strict';

const { prisma } = require('../config/database');

function serializeLevels(levels) {
  if (!levels) return null;
  return typeof levels === 'string' ? levels : JSON.stringify(levels);
}

async function showOrCreate(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await prisma.academicActivity.findUnique({
      where: { id: activityId },
      include: { rubric: { include: { criteria: { orderBy: { order: 'asc' } } } } },
    });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });

    res.render('rubrics/edit', {
      title: 'Rúbrica de evaluación',
      activity,
      rubric: activity.rubric || null,
      criteria: activity.rubric?.criteria || [],
    });
  } catch (err) { next(err); }
}

async function save(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const { rubricName, rubricDescription, criteria } = req.body;

    // Parsear criterios del body
    let parsedCriteria = [];
    if (criteria) {
      if (Array.isArray(criteria)) {
        parsedCriteria = criteria;
      } else if (typeof criteria === 'string') {
        try { parsedCriteria = JSON.parse(criteria); } catch {}
      }
    }

    const totalScore = parsedCriteria.reduce((sum, c) => sum + parseFloat(c.maxScore || 0), 0);

    const existing = await prisma.rubric.findUnique({ where: { activityId } });

    if (existing) {
      // Eliminar criterios anteriores y recrear
      await prisma.rubricCriterion.deleteMany({ where: { rubricId: existing.id } });
      await prisma.rubric.update({
        where: { activityId },
        data: {
          name: rubricName || 'Rúbrica de evaluación',
          description: rubricDescription,
          totalScore,
          criteria: {
            create: parsedCriteria.map((c, idx) => ({
              name: c.name,
              description: c.description,
              maxScore: parseFloat(c.maxScore || 0),
              levels: serializeLevels(c.levels),
              order: idx,
            })),
          },
        },
      });
    } else {
      await prisma.rubric.create({
        data: {
          activityId,
          name: rubricName || 'Rúbrica de evaluación',
          description: rubricDescription,
          totalScore,
          criteria: {
            create: parsedCriteria.map((c, idx) => ({
              name: c.name,
              description: c.description,
              maxScore: parseFloat(c.maxScore || 0),
              levels: serializeLevels(c.levels),
              order: idx,
            })),
          },
        },
      });
    }

    req.flash('success', 'Rúbrica guardada correctamente');
    res.redirect(`/actividades/${activityId}`);
  } catch (err) { next(err); }
}

async function saveAPI(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const { name, description, criteria } = req.body;

    const totalScore = (criteria || []).reduce((sum, c) => sum + parseFloat(c.maxScore || 0), 0);
    const existing = await prisma.rubric.findUnique({ where: { activityId } });

    if (existing) {
      await prisma.rubricCriterion.deleteMany({ where: { rubricId: existing.id } });
      const updated = await prisma.rubric.update({
        where: { activityId },
        data: {
          name: name || 'Rúbrica',
          description,
          totalScore,
          criteria: {
            create: (criteria || []).map((c, idx) => ({
              name: c.name, description: c.description,
              maxScore: parseFloat(c.maxScore || 0),
              levels: serializeLevels(c.levels),
              order: idx,
            })),
          },
        },
        include: { criteria: true },
      });
      return res.json({ success: true, rubric: updated });
    } else {
      const created = await prisma.rubric.create({
        data: {
          activityId,
          name: name || 'Rúbrica',
          description,
          totalScore,
          criteria: {
            create: (criteria || []).map((c, idx) => ({
              name: c.name, description: c.description,
              maxScore: parseFloat(c.maxScore || 0),
              levels: serializeLevels(c.levels),
              order: idx,
            })),
          },
        },
        include: { criteria: true },
      });
      return res.json({ success: true, rubric: created });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { showOrCreate, save, saveAPI };
