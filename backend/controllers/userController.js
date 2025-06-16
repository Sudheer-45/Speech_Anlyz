// backend/controllers/userController.js
// This controller now expects profilePictureUrl to be provided by the frontend
// after the frontend has uploaded the image to Cloudinary via /api/upload/profile-image.

const User = require('../models/User');
const Video = require('../models/Video'); // Assuming this model is used for dashboard data
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');

// @desc    Get user profile (No change to this function, but included for context if you copy-paste)
// @route   GET /api/user/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
        console.log('DEBUG: Fetched user profile in getUserProfile:', {
            _id: user._id,
            username: user.username,
            email: user.email,
            bio: user.bio,
            profilePictureUrl: user.profilePictureUrl,
        });
        res.json({
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                profilePictureUrl: user.profilePictureUrl,
                bio: user.bio,
                createdAt: user.createdAt,
            },
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get dashboard data for the user (No change to this function)
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        const totalVideosAnalyzed = await Video.countDocuments({ userId });

        const analyzedVideos = await Video.find({ userId, 'analysis.overallScore': { $ne: null } });
        let averageOverallScore = 0;
        if (analyzedVideos.length > 0) {
            const sumScores = analyzedVideos.reduce((acc, video) => acc + video.analysis.overallScore, 0);
            averageOverallScore = sumScores / analyzedVideos.length;
        }

        const latestVideo = await Video.findOne({ userId }).sort({ uploadDate: -1 });
        const latestAnalysisDate = latestVideo ? latestVideo.uploadDate : null;

        const recentFeedback = await Video.find({ userId, 'analysis.grammarFeedback': { $ne: null } })
            .sort({ uploadDate: -1 })
            .limit(3)
            .select('analysis.grammarFeedback analysis.fluencyFeedback');

        res.json({
            totalVideosAnalyzed,
            averageOverallScore,
            latestAnalysisDate,
            recentFeedback,
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Server error fetching dashboard data.' });
    }
});

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
    // Expected change: `profilePictureUrl` is now sent in the request body by the frontend.
    // It will be the Cloudinary URL obtained from the /api/upload/profile-image endpoint.
    const { username, email, password, bio, profilePictureUrl } = req.body; 

    console.log('DEBUG: Received req.body in updateProfile:', req.body); 

    const user = await User.findById(req.user._id);

    if (user) {
        user.username = username || user.username;
        user.email = email || user.email;
        user.bio = bio || user.bio;
        
        // This is the key change: `profilePictureUrl` is assigned directly from `req.body`.
        // The `profilePictureUrl !== undefined ? profilePictureUrl : user.profilePictureUrl`
        // handles cases where the field might not be present in the request (undefined)
        // vs. explicitly sent as null/empty string (meaning clear it).
        user.profilePictureUrl = profilePictureUrl !== undefined ? profilePictureUrl : user.profilePictureUrl;
        console.log('DEBUG: Setting user profilePictureUrl to:', user.profilePictureUrl);

        if (password) {
            if (password.length < 6) {
                res.status(400);
                throw new Error('Password must be at least 6 characters long');
            }
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await user.save();
        console.log('DEBUG: Updated user in DB:', {
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            bio: updatedUser.bio,
            profilePictureUrl: updatedUser.profilePictureUrl,
        });

        res.status(200).json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            profilePictureUrl: updatedUser.profilePictureUrl,
            bio: updatedUser.bio,
            message: 'Profile updated successfully!',
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    getUserProfile,
    getDashboardData,
    updateProfile,
};
