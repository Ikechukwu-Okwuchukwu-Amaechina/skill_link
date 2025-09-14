const { uploadToCloudinary } = require('../middleware/upload');

// Simple upload service for use in controllers
class UploadService {
  // Upload image buffer to Cloudinary
  static async uploadImage(buffer, options = {}) {
    return await uploadToCloudinary(buffer, {
      folder: 'skill_link/images',
      resource_type: 'image',
      ...options
    });
  }

  // Upload any file buffer to Cloudinary
  static async uploadFile(buffer, options = {}) {
    return await uploadToCloudinary(buffer, {
      folder: 'skill_link/files',
      ...options
    });
  }

  // Upload portfolio image for skilled workers
  static async uploadPortfolio(buffer, userId) {
    return await uploadToCloudinary(buffer, {
      folder: `skill_link/portfolio/${userId}`,
      resource_type: 'image'
    });
  }

  // Upload company logo for employers
  static async uploadLogo(buffer, userId) {
    return await uploadToCloudinary(buffer, {
      folder: `skill_link/logos/${userId}`,
      resource_type: 'image'
    });
  }

  // Upload certification documents
  static async uploadDocument(buffer, userId) {
    return await uploadToCloudinary(buffer, {
      folder: `skill_link/documents/${userId}`
    });
  }
}

module.exports = UploadService;
