const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ApiError } = require('../utils');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSIONS[file.mimetype]}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      return cb(new ApiError(400, 'Format gambar harus JPG, PNG, WebP, atau GIF.'));
    }
    return cb(null, true);
  }
});

router.post('/', requireRole('seller', 'admin'), upload.single('image'), (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'File gambar tidak ditemukan.'));
  }
  return res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
