// backend/routes/video.js
// This file configures Multer to upload video files directly to Cloudinary,
// ensuring video persistence and asynchronous processing for large files.

const express = require('express');
const router = express.Router(); // Correct and robust way to initialize router
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
        folder: 'comm-analyzer/videos', // Specific folder for video uploads in Cloudinary
        resource_type: 'video', // IMPORTANT: This tells Cloudinary it's a video file
        // Optional: Convert video format on upload (e.g., to mp4 for broader playback compatibility)
        format: async (req, file) => 'mp4',
        // Generate a unique public ID for the video, including user ID and timestamp
        public_id: (req, file) => `video-${req.user ? req.user._id : 'guest'}-${Date.now()}`, 
        
        // --- CRITICAL ADDITION FOR LARGE VIDEOS ---
        // Ensure eager transformations are defined if you want them processed immediately
        // but note the 40MB limit for free tier eager transformations.
        eager: [ 
            { format: 'mp4', quality: 'auto', crop: 'limit', width: 1280, height: 720 }, 
        ],
        eager_async: true, // Process eager transformations in the background
        async: true, // Ensure the main upload itself is treated asynchronously (important for large files)
        // For production, you would definitely add a notification_url here
        // to trigger analysis only after Cloudinary has finished its processing.
        // notification_url: `${process.env.BACKEND_URL}/api/cloudinary-webhook` 
    },
    // Set a larger file size limit for Multer (e.g., 200 MB, adjust as needed)
    limits: { fileSize: 200 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => { 
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v']; 
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer video fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer video fileFilter: Received originalname:', file.originalname);

        if (isMimeTypeAllowed) {
            // Check if Cloudinary credentials are set before allowing upload to proceed
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                console.error('Cloudinary credentials not fully configured. Rejecting upload.');
                return cb(new Error('Server Error: Cloudinary is not configured correctly.'), false);
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
});

// Route for uploading video and starting analysis
router.post('/upload', protect, videoUpload.single('video'), uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
