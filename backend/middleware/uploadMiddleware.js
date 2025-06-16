// backend/middleware/uploadMiddleware.js
// This middleware now configures Multer to upload directly to Cloudinary.

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- Cloudinary Configuration (REQUIRED ENVIRONMENT VARIABLES IN RENDER) ---
// These MUST be set in your Render dashboard:
// CLOUDINARY_CLOUD_NAME
// CLOUDINARY_API_KEY
// CLOUDINARY_API_SECRET
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Cloudinary Storage Setup for Multer ---
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'comm-analyzer/profile-images', // This is the folder name in your Cloudinary account
        format: async (req, file) => 'webp', // Convert uploaded images to WebP for optimization
        // Public ID for the image: uses user ID if available, otherwise 'guest', plus a timestamp
        public_id: (req, file) => `profile-${req.user ? req.user._id : 'guest'}-${Date.now()}`, 
        // Optional: Apply transformations directly on upload (e.g., resize and optimize)
        transformation: [{ width: 500, height: 500, crop: "limit", quality: "auto:low" }]
    },
});

// --- Multer Configuration using Cloudinary Storage ---
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => { // Ensures only image files are accepted
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB file size limit
    },
});

module.exports = upload; // Export the configured Multer upload middleware
