const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    uploadVideo, 
    getUserVideos,
    checkVideoStatus
} = require('../controllers/videoController');
const multer = require('multer');

// Configure Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 200 * 1024 * 1024, // 200MB limit
        files: 1 // Only allow single file upload
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
            'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed!'), false);
        }
    }
});

// Route for uploading video
router.post('/upload', 
    protect,
    upload.single('video'),
    asyncHandler(async (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'No video file provided' 
            });
        }
        next();
    }),
    uploadVideo
);

// Route to get user's videos
router.get('/user/videos', protect, getUserVideos);

// Route to check video status
router.get('/status/:videoId', protect, checkVideoStatus);

module.exports = router;
