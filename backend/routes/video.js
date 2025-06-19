// backend/routes/video.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadVideo, getUserVideos } = require('../controllers/videoController');

// Cloudinary integration for Multer
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with your credentials from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure CloudinaryStorage for VIDEO uploads
const cloudinaryVideoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'comm-analyzer/videos', // Your dedicated folder
        resource_type: 'video', // Must be 'video' for video uploads
        // Simplification: Removing 'format' and 'eager' for initial testing.
        // If this works, we can re-introduce them.
        public_id: (req, file) => `video-${req.user ? req.user._id : 'guest'}-${Date.now()}`, 
        async: true, // Crucial for larger files and non-blocking uploads
    },
    limits: { fileSize: 200 * 1024 * 1024 }, // Multer side limit (200MB)
    fileFilter: (req, file, cb) => { 
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v']; 
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer video fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer video fileFilter: Received originalname:', file.originalname);

        if (isMimeTypeAllowed) {
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                console.error('Cloudinary credentials not fully configured. Rejecting upload in fileFilter.');
                return cb(new Error('Server Error: Cloudinary is not configured correctly. Missing credentials.'), false);
            }
            return cb(null, true); 
        } else {
            console.error('Backend Multer video fileFilter: Rejected file due to mimetype:', file.mimetype);
            cb(new Error('Only video files are allowed!'), false); 
        }
    },
});

// Create a Multer upload instance using CloudinaryStorage for videos
const videoUpload = multer({
    storage: cloudinaryVideoStorage, 
    // Add specific error handling for Multer here
    fileFilter: (req, file, cb) => {
        // Multer fileFilter is called before CloudinaryStorage processes.
        // The fileFilter logic is defined in cloudinaryVideoStorage params above.
        // This is a redundant check, but ensures if something goes wrong, it's caught.
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            console.error('Multer fileFilter (main): Rejected file due to mimetype:', file.mimetype);
            return cb(new Error('File type not supported.'), false);
        }
        cb(null, true);
    },
    // Adding a generic Multer error handler to catch issues before the controller
}).single('video'); // Directly apply .single('video') here

// Route for uploading video and starting analysis
router.post('/upload', protect, (req, res, next) => {
    videoUpload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            console.error('Multer Error:', err);
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred when uploading.
            console.error('Unknown Upload Error:', err);
            return res.status(500).json({ message: `An unexpected error occurred during upload: ${err.message}` });
        }
        next(); // Everything went fine, pass to uploadVideo controller
    });
}, uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
