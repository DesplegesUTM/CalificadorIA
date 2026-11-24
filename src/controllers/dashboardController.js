'use strict';

const { prisma } = require('../config/database');

async function index(req, res) {
  try {
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'ADMIN';

    const whereClause = isAdmin ? {} : { userId };
    const activityWhere = isAdmin ? {} : { userId };

    const [subjectCount, activityCount, submissionStats, recentEvaluations] = await Promise.all([
      prisma.subject.count({ where: whereClause }),
      prisma.academicActivity.count({ where: activityWhere }),
      prisma.submission.groupBy({
        by: ['status'],
        _count: { status: true },
        where: isAdmin ? {} : {
          activity: { userId },
        },
      }),
      prisma.evaluation.findMany({
        where: isAdmin ? { status: 'COMPLETED' } : {
          status: 'COMPLETED',
          submission: { activity: { userId } },
        },
        include: {
          submission: {
            include: { student: true, activity: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalSubmissions = submissionStats.reduce((acc, s) => acc + s._count.status, 0);
    const evaluatedSubmissions = submissionStats.find(s => s.status === 'EVALUATED')?._count?.status || 0;
    const pendingSubmissions = submissionStats.find(s => s.status === 'PENDING')?._count?.status || 0;

    // Calcular promedio general
    const avgResult = await prisma.evaluation.aggregate({
      _avg: { percentage: true },
      where: {
        status: 'COMPLETED',
        ...(isAdmin ? {} : { submission: { activity: { userId } } }),
      },
    });
    const averageScore = Math.round((avgResult._avg.percentage || 0) * 10) / 10;

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: {
        subjects: subjectCount,
        activities: activityCount,
        total: totalSubmissions,
        evaluated: evaluatedSubmissions,
        pending: pendingSubmissions,
        average: averageScore,
      },
      recentEvaluations,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { index };
