// backend/routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Assuming your authMiddleware is here
const upload = require('../middleware/uploadMiddleware'); // Your multer upload middleware

// @desc    Upload profile image
// @route   POST /api/upload/profile-image
// @access  Private
router.post('/profile-image', protect, upload.single('profileImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  // Construct the URL where the image can be accessed
  // This assumes your static files are served from /uploads/profile-images/
 const imageUrl = `http://localhost:5000/${req.file.path.replace(/\\/g, '/')}`;
  console.log('Image uploaded successfully. Returned URL:', imageUrl); // Add this log
  res.json({ message: 'Image uploaded successfully', imageUrl: imageUrl });
});

module.exports = router;