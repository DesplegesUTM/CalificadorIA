'use strict';

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');

const exportDir = path.join(process.cwd(), process.env.EXPORT_DIR || 'exports');
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

/**
 * Generar reporte Excel de evaluaciones de una actividad
 */
async function generateActivityReport(activityId, evaluations) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EvaluadorIA';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Evaluaciones', {
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  // Estilos
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    },
  };

  const dataStyle = {
    alignment: { vertical: 'top', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    },
  };

  // Recopilar todos los criterios únicos
  const criteriaNames = new Set();
  for (const ev of evaluations) {
    for (const cs of ev.criterionScores || []) {
      criteriaNames.add(cs.criterion?.name || `Criterio ${cs.criterionId}`);
    }
  }
  const criteriaList = Array.from(criteriaNames);

  // Encabezados
  const headers = [
    { header: 'N°', key: 'num', width: 5 },
    { header: 'Estudiante', key: 'student', width: 25 },
    { header: 'Título del trabajo', key: 'title', width: 35 },
    { header: 'Fecha evaluación', key: 'date', width: 18 },
    ...criteriaList.map(name => ({ header: name, key: `crit_${name}`, width: 15 })),
    { header: 'Nota total', key: 'total', width: 12 },
    { header: 'Nota máxima', key: 'maxScore', width: 12 },
    { header: 'Porcentaje', key: 'percentage', width: 12 },
    { header: 'Retroalimentación', key: 'feedback', width: 50 },
    { header: 'Fortalezas', key: 'strengths', width: 40 },
    { header: 'Debilidades', key: 'weaknesses', width: 40 },
    { header: 'Recomendaciones', key: 'recommendations', width: 40 },
  ];

  sheet.columns = headers;

  // Aplicar estilos a encabezados
  sheet.getRow(1).eachCell((cell) => {
    Object.assign(cell, headerStyle);
  });
  sheet.getRow(1).height = 40;

  // Datos
  evaluations.forEach((ev, idx) => {
    const criteriaScoreMap = {};
    for (const cs of ev.criterionScores || []) {
      const name = cs.criterion?.name || `Criterio ${cs.criterionId}`;
      criteriaScoreMap[name] = cs.score;
    }

    const rowData = {
      num: idx + 1,
      student: ev.submission?.student?.fullName || 'Desconocido',
      title: ev.submission?.title || 'Sin título',
      date: ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('es-ES') : '-',
      ...Object.fromEntries(criteriaList.map(name => [`crit_${name}`, criteriaScoreMap[name] ?? '-'])),
      total: ev.totalScore,
      maxScore: ev.maxScore,
      percentage: `${Math.round(ev.percentage)}%`,
      feedback: ev.feedback || '',
      strengths: ev.strengths || '',
      weaknesses: ev.weaknesses || '',
      recommendations: ev.recommendations || '',
    };

    const row = sheet.addRow(rowData);
    row.eachCell((cell) => Object.assign(cell, dataStyle));

    // Color alternado de filas
    if (idx % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    // Color de nota según porcentaje
    const percCell = row.getCell('percentage');
    const perc = ev.percentage || 0;
    percCell.font = {
      bold: true,
      color: { argb: perc >= 70 ? 'FF16A34A' : perc >= 50 ? 'FFD97706' : 'FFDC2626' },
    };

    row.height = 60;
  });

  // Freeze primera fila
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto filter
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(65 + headers.length - 1)}1` };

  // Guardar archivo
  const fileName = `evaluaciones_actividad_${activityId}_${Date.now()}.xlsx`;
  const filePath = path.join(exportDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  logger.info(`[ExcelService] Reporte generado: ${fileName}`);
  return { filePath, fileName };
}

module.exports = { generateActivityReport };
