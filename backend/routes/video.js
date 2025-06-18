// backend/routes/video.js
// This file configures Multer to upload video files directly to Cloudinary,
// ensuring video persistence and asynchronous processing for large files.

const express = require('express');
const router = express.Router(); // CRITICAL FIX: Use express.Router() to create a router instance
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
        
        // --- CRITICAL ADDITION FOR LARGE VIDEOS (already added, ensure correct) ---
        eager: [ // Define transformations that Cloudinary should apply eagerly (asynchronously)
            { format: 'mp4', quality: 'auto', crop: 'limit', width: 1280, height: 720 }, // Example transformation
        ],
        eager_async: true, // Process eager transformations in the background
        async: true, // Ensure the main upload itself is treated asynchronously (important for large files)
        // For production, you would add a notification_url here to trigger analysis
        // after Cloudinary has finished its processing for very large videos.
        // notification_url: `${process.env.BACKEND_URL}/api/cloudinary-webhook` // Example
    },
    // Set a larger file size limit for Multer (e.g., 200 MB, adjust as needed)
    // This limit is for Multer, Cloudinary has its own limits.
    limits: { fileSize: 200 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => { 
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v']; 
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer video fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer video fileFilter: Received originalname:', file.originalname);

        if (isMimeTypeAllowed) {
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
// 'video' should be the name of the field in your FormData from the frontend
router.post('/upload', protect, videoUpload.single('video'), uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
