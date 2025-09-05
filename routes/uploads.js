const { Router } = require('express');
const path = require('path');
const { uploadAny, uploadImage } = require('../middleware/upload');

const router = Router();

// Helper to build a simple file response
function fileResponse(req, file) {
  // Build a URL path that matches our static mount (/uploads)
  const urlPath = `/uploads/${path.basename(file.path)}`;
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    url: urlPath, // relative path
    absoluteUrl: `${base}${urlPath}`,
  };
}

// POST /api/uploads/image  field name: image
router.post('/image', uploadImage.single('image'), function (req, res) {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  return res.status(201).json({ file: fileResponse(req, req.file) });
});

// POST /api/uploads/file  field name: file
router.post('/file', uploadAny.single('file'), function (req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return res.status(201).json({ file: fileResponse(req, req.file) });
});

module.exports = router;
