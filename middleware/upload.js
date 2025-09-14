const cloudinary = require('../config/cloudinary');
const multer = require('multer');

// Simple memory storage for multer (files stay in memory briefly)
const storage = multer.memoryStorage();

// Basic image filter
function imageFileFilter(req, file, cb) {
  const allowed = /^(image\/(png|jpe?g|gif|webp|bmp|svg))$/i;
  if (allowed.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files are allowed'));
}

// Generic accept-all filter
function anyFileFilter(req, file, cb) {
  cb(null, true);
}

// Limits: 10 MB default
const DEFAULT_LIMITS = { fileSize: 10 * 1024 * 1024 };

// Upload middlewares with memory storage
const uploadAny = multer({ 
  storage, 
  fileFilter: anyFileFilter, 
  limits: DEFAULT_LIMITS,
  onError: function(err, next) {
    console.error('Multer error:', err);
    next(err);
  }
});
const uploadImage = multer({ 
  storage, 
  fileFilter: imageFileFilter, 
  limits: DEFAULT_LIMITS,
  onError: function(err, next) {
    console.error('Multer error:', err);
    next(err);
  }
});

// Helper function to upload buffer to Cloudinary
async function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: options.folder || 'skill_link',
        ...options
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
}

module.exports = { uploadAny, uploadImage, uploadToCloudinary };
