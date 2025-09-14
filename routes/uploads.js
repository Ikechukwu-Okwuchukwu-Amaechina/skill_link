const { Router } = require('express');
const { uploadAny, uploadImage, uploadToCloudinary } = require('../middleware/upload');

const router = Router();

// Simple test route to check if multer is working
router.post('/test', uploadAny.single('file'), function (req, res) {
  console.log('Test upload:', {
    hasFile: !!req.file,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer ? req.file.buffer.length : 0
    } : null,
    body: req.body
  });
  
  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded',
      hint: 'Use field name "file" and multipart/form-data'
    });
  }
  
  return res.json({ 
    message: 'File received successfully',
    file: {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    }
  });
});

// Helper to build a simple file response from Cloudinary result
function fileResponse(cloudinaryResult, originalFile) {
  return {
    filename: originalFile.originalname,
    mimetype: originalFile.mimetype,
    size: originalFile.size,
    url: cloudinaryResult.secure_url,
    cloudinaryId: cloudinaryResult.public_id,
  };
}

// POST /api/uploads/image  field name: image
router.post('/image', async function (req, res, next) {
  try {
    // Try multipart first
    uploadImage.single('image')(req, res, async function(err) {
      if (err) {
        // If multipart fails, try JSON with base64
        if (err.message.includes('Boundary not found')) {
          try {
            const { filename, data } = req.body;
            if (!data || !filename) {
              return res.status(400).json({ 
                error: 'No image uploaded',
                hint: 'Use multipart/form-data with field "image" OR JSON with {filename, data: "base64string"}'
              });
            }
            
            const buffer = Buffer.from(data, 'base64');
            const result = await uploadToCloudinary(buffer, {
              folder: 'skill_link/images',
              resource_type: 'image'
            });
            
            return res.status(201).json({ 
              file: {
                filename,
                url: result.secure_url,
                cloudinaryId: result.public_id,
                size: buffer.length
              }
            });
          } catch (jsonError) {
            return res.status(400).json({ 
              error: 'Invalid image data',
              hint: 'Use multipart/form-data with field "image" OR JSON with {filename, data: "base64string"}'
            });
          }
        } else {
          return next(err);
        }
      } else {
        // Multipart worked
        if (!req.file) {
          return res.status(400).json({ 
            error: 'No image uploaded',
            hint: 'Use field name "image" and multipart/form-data'
          });
        }
        
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'skill_link/images',
          resource_type: 'image'
        });
        
        return res.status(201).json({ file: fileResponse(result, req.file) });
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

// POST /api/uploads/file  field name: file
router.post('/file', async function (req, res, next) {
  try {
    // Try multipart first
    uploadAny.single('file')(req, res, async function(err) {
      if (err) {
        // If multipart fails, try JSON with base64
        if (err.message.includes('Boundary not found')) {
          try {
            const { filename, data } = req.body;
            if (!data || !filename) {
              return res.status(400).json({ 
                error: 'No file uploaded',
                hint: 'Use multipart/form-data with field "file" OR JSON with {filename, data: "base64string"}'
              });
            }
            
            const buffer = Buffer.from(data, 'base64');
            const result = await uploadToCloudinary(buffer, {
              folder: 'skill_link/files'
            });
            
            return res.status(201).json({ 
              file: {
                filename,
                url: result.secure_url,
                cloudinaryId: result.public_id,
                size: buffer.length
              }
            });
          } catch (jsonError) {
            return res.status(400).json({ 
              error: 'Invalid file data',
              hint: 'Use multipart/form-data with field "file" OR JSON with {filename, data: "base64string"}'
            });
          }
        } else {
          return next(err);
        }
      } else {
        // Multipart worked
        if (!req.file) {
          return res.status(400).json({ 
            error: 'No file uploaded',
            hint: 'Use field name "file" and multipart/form-data'
          });
        }
        
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'skill_link/files'
        });
        
        return res.status(201).json({ file: fileResponse(result, req.file) });
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

module.exports = router;
