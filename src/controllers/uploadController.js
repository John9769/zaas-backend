const cloudinary = require('../utils/cloudinary');
const multer = require('multer');

// ============================================
// MULTER CONFIG
// Memory storage — files held in buffer
// before uploading to Cloudinary
// Max 10 photos, 10MB each
// ============================================
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG and WEBP images allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10                    // max 10 photos
  }
});

// ============================================
// UPLOAD PHOTOS
// POST /api/upload/photos
// Step 1 of order flow
// Just uploads to Cloudinary, returns URLs
// Hero selection happens in FE AFTER this
// ============================================
const uploadPhotos = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No photos uploaded'
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 photos allowed'
      });
    }

    // Upload all photos to Cloudinary in parallel
    const uploadPromises = req.files.map((file, index) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'zaas/uploads',
            resource_type: 'image',
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({
              cloudinary_url: result.secure_url,
              cloudinary_public_id: result.public_id,
              width: result.width,
              height: result.height,
              file_size_kb: Math.round(result.bytes / 1024),
              sort_order: index + 1,
              is_hero: false // hero selected by USER in FE after upload
            });
          }
        );
        uploadStream.end(file.buffer);
      });
    });

    const uploadedPhotos = await Promise.all(uploadPromises);

    // Quality warning — flag photos under 100kb as potentially low quality
    const lowQualityPhotos = uploadedPhotos.filter(p => p.file_size_kb < 100);

    res.json({
      success: true,
      message: `${uploadedPhotos.length} photos uploaded successfully`,
      data: {
        photos: uploadedPhotos,
        total: uploadedPhotos.length,
        hero_public_id: null, // user picks this in FE
        quality_warning: lowQualityPhotos.length > 0
          ? `${lowQualityPhotos.length} photo(s) may be low quality. For best results upload clear, well-lit photos minimum 1MB each.`
          : null
      }
    });

  } catch (error) {
    console.error('uploadPhotos error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload photos'
    });
  }
};

module.exports = { upload, uploadPhotos };