// backend/routes/uploadRoutes.js
// This route is now specifically for uploading profile images to Cloudinary.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Middleware to ensure user is authenticated
const upload = require('../middleware/uploadMiddleware'); // Your updated Multer upload middleware (Cloudinary-enabled)

// @desc    Upload profile image to Cloudinary
// @route   POST /api/upload/profile-image
// @access  Private (requires authentication)
router.post('/profile-image', protect, upload.single('profileImage'), (req, res) => {
    // Check if a file was successfully uploaded by Multer
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // When using multer-storage-cloudinary, req.file.path directly contains the secure URL
    // of the uploaded image on Cloudinary.
    const imageUrl = req.file.path; 
    console.log('Image uploaded successfully to Cloudinary. Returned URL:', imageUrl); 
    
    // Send back a success message and the Cloudinary URL to the frontend
    res.json({ message: 'Image uploaded successfully', imageUrl: imageUrl });
});

module.exports = router;
