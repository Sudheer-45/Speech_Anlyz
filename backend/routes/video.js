// backend/routes/video.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadVideo, getUserVideos } = require('../controllers/videoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Ensure fs is imported

// Set up storage for uploaded videos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the 'uploads' directory exists. Create it if it doesn't.
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Videos will be stored in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        // Create a unique filename: timestamp + original extension
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB file size limit
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']; 
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer fileFilter: Received originalname:', file.originalname);

        if (isMimeTypeAllowed) {
            return cb(null, true);
        } else {
            console.error('Backend Multer fileFilter: Rejected file due to mimetype:', file.mimetype);
            cb(new Error('Only video files are allowed!'), false);
        }
    },
});

router.post('/upload', protect, upload.single('video'), uploadVideo);
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
