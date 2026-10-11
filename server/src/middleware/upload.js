import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_request, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.m4a'}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('audio/')),
});
