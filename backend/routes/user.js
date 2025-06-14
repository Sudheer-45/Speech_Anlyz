const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getUserProfile, getDashboardData,updateProfile } = require('../controllers/userController');

router.get('/profile', protect, getUserProfile);
router.get('/dashboard', protect, getDashboardData);
router.put('/profile', protect, updateProfile); 

module.exports = router;