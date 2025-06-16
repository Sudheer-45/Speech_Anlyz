// backend/routes/user.js
// Multer-related imports and setup for Cloudinary are removed from here.
// Image uploads are now handled by the dedicated /api/upload/profile-image route.

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getUserProfile, getDashboardData, updateProfile } = require('../controllers/userController');

// All Multer and Cloudinary config related to file uploads is now externalized
// to backend/middleware/uploadMiddleware.js and used in backend/routes/uploadRoutes.js.
// No 'multer' or 'cloudinary' imports are needed here.


router.get('/profile', protect, getUserProfile);
router.get('/dashboard', protect, getDashboardData);

// The /api/user/profile PUT route no longer takes a file directly.
// It expects the profilePictureUrl to be present in the request body,
// which the frontend obtains from the /api/upload/profile-image endpoint.
router.put('/profile', protect, updateProfile); 

module.exports = router;
