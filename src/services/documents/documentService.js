'use strict';

const { PDFParse } = require('pdf-parse');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');

/**
 * Extrae texto de un archivo PDF dado su ruta en disco
 */
async function extractTextFromPDF(filePath) {
  let parser;
  try {
    const buffer = fs.readFileSync(filePath);
    parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const infoData = await parser.getInfo();
    return {
      text: data.text || '',
      pages: data.total || 0,
      info: infoData.info || {},
      isLegible: (data.text || '').trim().length > 50,
    };
  } catch (err) {
    logger.error(`[DocumentService] Error extrayendo PDF ${filePath}: ${err.message}`);
    return { text: '', pages: 0, info: {}, isLegible: false, error: err.message };
  } finally {
    if (parser) await parser.destroy();
  }
}

/**
 * Procesa un archivo ZIP de Moodle y extrae los PDFs contenidos
 * Formato Moodle: NombreEstudiante_ID_submissionfile/archivo.pdf
 */
async function processZipFile(zipPath, destDir) {
  const results = [];
  
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      
      const entryName = entry.entryName.replace(/\\/g, '/');
      const ext = path.extname(entryName).toLowerCase();
      
      if (ext !== '.pdf') continue;

      // Intentar detectar el nombre del estudiante desde la ruta del ZIP de Moodle
      // Formato típico: "Nombre Apellido_ID_assignsubmission_file_/documento.pdf"
      const studentInfo = detectStudentFromPath(entryName);
      
      // Nombre seguro para guardar
      const crypto = require('crypto');
      const safeFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
      const outputPath = path.join(destDir, safeFileName);

      // Extraer el archivo
      const content = entry.getData();
      fs.writeFileSync(outputPath, content);

      // Extraer texto del PDF
      const pdfData = await extractTextFromPDF(outputPath);

      results.push({
        originalName: path.basename(entryName),
        storedPath: outputPath,
        storedName: safeFileName,
        studentName: studentInfo.name,
        studentId: studentInfo.id,
        title: detectTitle(pdfData.text),
        textContent: pdfData.text,
        pages: pdfData.pages,
        isLegible: pdfData.isLegible,
        error: pdfData.error || null,
      });
    }

    logger.info(`[DocumentService] ZIP procesado: ${results.length} PDFs extraídos`);
    return results;
  } catch (err) {
    logger.error(`[DocumentService] Error procesando ZIP: ${err.message}`);
    throw new Error(`Error al procesar el archivo ZIP: ${err.message}`);
  }
}

/**
 * Detectar nombre de estudiante desde la ruta del ZIP de Moodle
 */
function detectStudentFromPath(entryPath) {
  const parts = entryPath.replace(/\\/g, '/').split('/');
  const folderName = parts.length > 1 ? parts[0] : path.parse(parts[0]).name;
  
  // Patrón Moodle: "Nombre Apellido_ID_assignsubmission_file_"
  const moodlePattern = /^(.+?)_(\d+)_/;
  const match = folderName.match(moodlePattern);
  
  if (match) {
    return { name: match[1].replace(/_/g, ' ').trim(), id: match[2] };
  }

  // Fallback: usar el nombre de la carpeta
  return { name: folderName.replace(/_/g, ' ').trim() || 'Estudiante Desconocido', id: null };
}

/**
 * Detectar el título del trabajo desde el texto del PDF
 */
function detectTitle(text) {
  if (!text) return null;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  
  // La primera línea no vacía suele ser el título
  for (const line of lines.slice(0, 10)) {
    if (line.length > 5 && line.length < 200 && !line.match(/^\d/) && !line.match(/^[a-z]/)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Limpiar y sanitizar texto extraído de PDF
 */
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

module.exports = {
  extractTextFromPDF,
  processZipFile,
  detectStudentFromPath,
  detectTitle,
  sanitizeText,
};
