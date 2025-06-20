// backend/routes/video.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadVideo, getUserVideos } = require('../controllers/videoController');

const multer = require('multer');

// Configure Multer memory storage to get file buffer directly
const storage = multer.memoryStorage(); // Store files in memory as a buffer
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for in-memory upload
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
            'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported. Only video files are allowed!'), false);
        }
    }
}).single('video');

// Route for uploading video and starting analysis
router.post('/upload', protect, (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error during file upload:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Video file is too large. Maximum size is 200MB.' });
            }
            return res.status(400).json({ message: `Video upload failed: ${err.message}` });
        } else if (err) {
            console.error('Unknown Error during Multer file upload:', err);
            return res.status(500).json({ message: `An unexpected error occurred during file upload: ${err.message}` });
        }
        next(); // Pass control to uploadVideo controller
    });
}, uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
