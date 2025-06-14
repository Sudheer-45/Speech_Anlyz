// backend/routes/video.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadVideo, getUserVideos } = require('../controllers/videoController');
const multer = require('multer');
const path = require('path');

// Set up storage for uploaded videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Videos will be stored in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB file size limit
  fileFilter: (req, file, cb) => {
    // --- UPDATED fileFilter LOGIC ---
    // Allowed mimetypes explicitly
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']; // Common video mimetypes
    
    // Check if the file's mimetype is in our allowed list
    const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

    // Optionally, you can also check file extension, but mimetype is more reliable for recorded blobs
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isExtensionAllowed = ['.mp4', '.mov', '.avi', '.webm'].includes(fileExtension);

    // For robustness, we often allow if either mimetype OR extension is correct,
    // but the error suggests mimetype is the direct problem.
    // Let's make sure 'video/webm' is explicitly handled.
    
    // Log the received mimetype for debugging (useful if it's not exactly 'video/webm')
    console.log('Backend Multer fileFilter: Received mimetype:', file.mimetype);
    console.log('Backend Multer fileFilter: Received originalname:', file.originalname);


    if (isMimeTypeAllowed) { // Only check mimetype for now, as it's the direct source of error
      return cb(null, true); // Accept the file
    } else {
      console.error('Backend Multer fileFilter: Rejected file due to mimetype:', file.mimetype);
      cb(new Error('Only video files are allowed!'), false); // Reject the file
    }
  },
});

router.post('/upload', protect, upload.single('video'), uploadVideo);
router.get('/user/videos', protect, getUserVideos);

module.exports = router;