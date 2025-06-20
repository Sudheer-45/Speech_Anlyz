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
// IMPORTANT: Ensure these are correctly set in your Render environment
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure CloudinaryStorage for VIDEO uploads
const cloudinaryVideoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => { // Use async function for params to access req and file dynamically
        console.log('Multer Cloudinary Params: Processing file:', file.originalname);
        console.log('Multer Cloudinary Params: MimeType:', file.mimetype);

        // This public_id will be the filename in Cloudinary
        const publicId = `video-${req.user ? req.user._id : 'guest'}-${Date.now()}`;

        return {
            folder: 'comm-analyzer/videos', // Your dedicated folder in Cloudinary
            resource_type: 'video',       // MUST be 'video' for video uploads
            public_id: publicId,
            chunk_size: 6000000,          // Recommended for large files (e.g., 6MB chunks)
            async: true,                  // Crucial for larger files and non-blocking uploads

            // Temporarily removed 'eager' and 'format' for initial testing as they can cause issues.
            // If direct upload works, you can re-introduce eager transformations carefully
            // eager: [{ width: 300, height: 300, crop: 'pad', audio_codec: 'none' }],
            // eager_async: true,
            // format: 'mp4' // Convert to MP4
        };
    },
    // The fileFilter should primarily reside here for CloudinaryStorage
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
            'video/x-flv', 'video/3gpp', 'video/mpeg', 'video/x-m4v'
        ];
        const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype);

        console.log('Backend Multer video fileFilter: Received mimetype:', file.mimetype);
        console.log('Backend Multer video fileFilter: Received originalname:', file.originalname);

        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary credentials not fully configured. Rejecting upload in fileFilter.');
            return cb(new Error('Server Error: Cloudinary is not configured correctly. Missing credentials.'), false);
        }

        if (isMimeTypeAllowed) {
            cb(null, true);
        } else {
            console.error('Backend Multer video fileFilter: Rejected file due to mimetype:', file.mimetype);
            cb(new Error('Only video files (MP4, MOV, AVI, WebM, FLV, 3GPP, MPEG, M4V) are allowed!'), false);
        }
    }
});

// Create a Multer upload instance
const videoUpload = multer({
    storage: cloudinaryVideoStorage,
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB file size limit for Multer (adjust as needed)
    // The fileFilter logic is now exclusively within `cloudinaryVideoStorage` for clarity.
    // If you need a pre-storage filter, you can add it here, but it's often redundant.
}).single('video');

// Route for uploading video and starting analysis
router.post('/upload', protect, (req, res, next) => {
    videoUpload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer-specific error occurred (e.g., file size limit)
            console.error('Multer Error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'Video file is too large. Maximum size is 200MB.' });
            }
            return res.status(400).json({ message: `Video upload failed: ${err.message}` });
        } else if (err) {
            // Other errors, potentially from CloudinaryStorage
            console.error('Upload Error (possibly from CloudinaryStorage or fileFilter):', err);
            // Check if the error message is related to Cloudinary specifically
            if (err.message.includes('Cloudinary error:') || err.message.includes('Upload failed') || err.message.includes('No such file or directory') || err.message.includes('File type not supported')) {
                return res.status(500).json({ message: `Cloudinary upload or file processing failed: ${err.message}` });
            }
            return res.status(500).json({ message: `An unexpected error occurred during video upload: ${err.message}` });
        }

        // If no error but req.file is missing, something went wrong with file processing
        if (!req.file) {
            console.error('Multer finished without error, but req.file is missing. Cloudinary processing might have failed silently.');
            return res.status(500).json({ message: 'Server error: Video file was not processed correctly. Please try again.' });
        }

        // Successfully uploaded to Cloudinary, proceed to controller
        console.log('Video successfully uploaded to Cloudinary. File details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,     // The Cloudinary URL
            filename: req.file.filename // The Cloudinary public_id (from our params: public_id)
        });
        next();
    });
}, uploadVideo);

// Route to get a list of user's uploaded videos
router.get('/user/videos', protect, getUserVideos);

module.exports = router;
