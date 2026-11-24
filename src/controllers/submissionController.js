'use strict';

const path = require('path');
const fs = require('fs');
const { prisma } = require('../config/database');
const { extractTextFromPDF, processZipFile, sanitizeText } = require('../services/documents/documentService');

async function index(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await prisma.academicActivity.findUnique({
      where: { id: activityId },
      include: { subject: true },
    });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });

    const submissions = await prisma.submission.findMany({
      where: { activityId },
      include: {
        student: true,
        evaluations: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.render('submissions/index', { title: 'Entregas', activity, submissions });
  } catch (err) { next(err); }
}

async function showUpload(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await prisma.academicActivity.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });
    res.render('submissions/upload', { title: 'Importar entregas', activity, errors: [] });
  } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const activity = await prisma.academicActivity.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });
    
    if (!req.file) {
      return res.render('submissions/upload', {
        title: 'Importar entregas',
        activity,
        errors: ['Debe seleccionar un archivo PDF o ZIP'],
      });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const uploadDir = path.dirname(filePath);
    
    let submissionsToCreate = [];

    if (ext === '.zip') {
      // Procesar ZIP de Moodle
      const extracted = await processZipFile(filePath, path.join(uploadDir, 'extracted'));
      
      for (const doc of extracted) {
        submissionsToCreate.push({
          studentName: doc.studentName || 'Desconocido',
          studentId: doc.studentId,
          originalFile: doc.originalName,
          storedFile: doc.storedName,
          storedPath: doc.storedPath,
          textContent: sanitizeText(doc.textContent),
          isLegible: doc.isLegible,
          fileSize: fs.statSync(doc.storedPath).size,
        });
      }
      // Eliminar el ZIP original
      fs.unlinkSync(filePath);
    } else {
      // PDF individual
      const pdfData = await extractTextFromPDF(filePath);
      submissionsToCreate.push({
        studentName: path.parse(req.file.originalname).name.replace(/_/g, ' ').trim() || 'Estudiante',
        studentId: null,
        originalFile: req.file.originalname,
        storedFile: req.file.filename,
        storedPath: filePath,
        textContent: sanitizeText(pdfData.text),
        isLegible: pdfData.isLegible,
        fileSize: req.file.size,
      });
    }

    // Mostrar previsualización para corrección manual
    req.session.pendingSubmissions = { activityId, documents: submissionsToCreate };
    res.render('submissions/preview', {
      title: 'Previsualizar entregas',
      activityId,
      activity,
      documents: submissionsToCreate,
    });
  } catch (err) { next(err); }
}

async function confirmImport(req, res, next) {
  try {
    const activityId = parseInt(req.params.activityId);
    const pending = req.session.pendingSubmissions;

    if (!pending || pending.activityId !== activityId) {
      req.flash('error', 'La vista previa de importación expiró. Vuelve a cargar los archivos.');
      return res.redirect(`/entregas/actividad/${activityId}/subir`);
    }

    const activity = await prisma.academicActivity.findUnique({
      where: { id: activityId },
      select: { id: true, title: true },
    });
    if (!activity) return res.status(404).render('errors/404', { title: 'No encontrado' });

    let submittedDocuments = req.body.documents || [];
    if (typeof submittedDocuments === 'string') {
      submittedDocuments = JSON.parse(submittedDocuments);
    }
    if (!Array.isArray(submittedDocuments)) {
      submittedDocuments = Object.keys(submittedDocuments)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => submittedDocuments[key]);
    }

    const docs = pending.documents;
    let created = 0;
    let skipped = 0;

    for (const [index, doc] of docs.entries()) {
      const submitted = submittedDocuments[index] || {};
      if (submitted.include !== 'true') { skipped++; continue; }

      const studentName = typeof submitted.studentName === 'string' && submitted.studentName.trim()
        ? submitted.studentName.trim()
        : doc.studentName || 'Estudiante';
      const studentId = Object.prototype.hasOwnProperty.call(submitted, 'studentId')
        ? (typeof submitted.studentId === 'string' ? submitted.studentId.trim() : '') || null
        : doc.studentId || null;
      // Buscar o crear estudiante
      let student = await prisma.student.findFirst({
        where: {
          OR: [
            { fullName: studentName, studentId: studentId || undefined },
          ],
        },
      });

      if (!student) {
        student = await prisma.student.create({
          data: {
            fullName: studentName,
            studentId,
          },
        });
      }

      await prisma.submission.create({
        data: {
          studentId: student.id,
          activityId,
          title: activity.title,
          originalFile: doc.originalFile || 'archivo.pdf',
          storedFile: doc.storedFile,
          fileSize: parseInt(doc.fileSize, 10) || 0,
          mimeType: 'application/pdf',
          textContent: doc.textContent || '',
          status: doc.isLegible === 'false' || doc.isLegible === false ? 'ILLEGIBLE' : 'PENDING',
        },
      });
      created++;
    }

    delete req.session.pendingSubmissions;
    req.flash('success', `Se importaron ${created} entregas correctamente${skipped > 0 ? ` (${skipped} omitidas)` : ''}`);
    res.redirect(`/actividades/${activityId}`);
  } catch (err) { next(err); }
}

async function destroy(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) return res.status(404).json({ success: false, error: 'No encontrado' });

    // Eliminar archivo físico
    const filePath = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', submission.storedFile);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.submission.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { index, showUpload, upload, confirmImport, destroy };
