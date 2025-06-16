// backend/routes/video.js
// This file configures Multer to upload video files directly to Cloudinary.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadVideo, getUserVideos } = require('../controllers/videoController');

// Cloudinary integration for Multer
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
// No longer need fs or path imports here as local storage is removed
// const fs = require('fs');
// const path = require('path');

// Configure Cloudinary with your credentials from environment variables
// These MUST be set in your Render dashboard (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
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
        // Optional: Apply video transformations here if desired (e.g., optimize for streaming)
        // transformation: [{ width: 1280, height: 720, crop: "limit", video_codec: "auto" }]
    },
    // Optional: Add a chunk_size for very large video files (e.g., 6MB)
    // For large files, consider using direct upload from frontend for better performance
    // chunk_size: 6000000 
});

// Create a Multer upload instance using CloudinaryStorage for videos
const videoUpload = multer({
    storage: cloudinaryVideoStorage,
    limits: { fileSize: 200 * 1024 * 1024 }, // Set a larger file size limit for videos (e.g., 200 MB)
    fileFilter: (req, file, cb) => { // Filter to allow only video files
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']; 
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer video fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer video fileFilter: Received originalname:', file.originalname);

        if (isMimeTypeAllowed) {
            return cb(null, true); // Accept the file
        } else {
            console.error('Backend Multer video fileFilter: Rejected file due to mimetype:', file.mimetype);
            cb(new Error('Only video files are allowed!'), false); // Reject the file
        }
    },
});

// Route for uploading video and starting analysis
// 'video' should be the name of the field in your FormData from the frontend
router.post('/upload', protect, videoUpload.single('video'), uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
