const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Storage engine: save with timestamped filename to avoid collisions
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

// Basic image filter
function imageFileFilter(req, file, cb) {
  const allowed = /^(image\/(png|jpe?g|gif|webp|bmp|svg|avif\+xml))$/i;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files are allowed'));
}

// Generic accept-all filter
function anyFileFilter(req, file, cb) {
  cb(null, true);
}

// Limits: 10 MB default (override per route if needed)
const DEFAULT_LIMITS = { fileSize: 10 * 1024 * 1024 };

// Ready-made upload middlewares
const uploadAny = multer({ storage, fileFilter: anyFileFilter, limits: DEFAULT_LIMITS });
const uploadImage = multer({ storage, fileFilter: imageFileFilter, limits: DEFAULT_LIMITS });

module.exports = { uploadAny, uploadImage, UPLOAD_DIR };
