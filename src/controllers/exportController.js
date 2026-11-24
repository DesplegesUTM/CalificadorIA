'use strict';

const path = require('path');
const { prisma } = require('../config/database');
const { generateActivityReport } = require('../services/excel/excelService');

async function exportActivity(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const { ids } = req.query; // IDs específicos o todas

    const whereClause = {
      status: 'COMPLETED',
      submission: { activityId },
    };
    if (ids) {
      whereClause.id = { in: ids.split(',').map(Number) };
    }

    const evaluations = await prisma.evaluation.findMany({
      where: whereClause,
      include: {
        submission: { include: { student: true, activity: { include: { subject: true } } } },
        criterionScores: { include: { criterion: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (evaluations.length === 0) {
      req.flash('error', 'No hay evaluaciones para exportar');
      return res.redirect(`/actividades/${activityId}`);
    }

    const { filePath, fileName } = await generateActivityReport(activityId, evaluations);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) { next(err); }
}

module.exports = { exportActivity };
