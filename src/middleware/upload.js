'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(uploadDir, String(req.session?.user?.id || 'anon'));
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

function fileFilter(allowedTypes) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${ext}. Permitidos: ${allowedTypes.join(', ')}`));
    }
  };
}

const uploadPDF = multer({
  storage,
  fileFilter: fileFilter(['.pdf']),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024 },
});

const uploadZIPorPDF = multer({
  storage,
  fileFilter: fileFilter(['.pdf', '.zip']),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024 },
});

const uploadReference = multer({
  storage,
  fileFilter: fileFilter(['.pdf', '.txt', '.docx']),
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = { uploadPDF, uploadZIPorPDF, uploadReference };
