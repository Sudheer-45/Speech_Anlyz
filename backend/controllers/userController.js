const User = require('../models/User');
const Video = require('../models/Video');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler'); // Ensure this is imported

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
// controllers/userController.js
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    console.log('DEBUG: Fetched user profile in getUserProfile:', {
      _id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      profilePictureUrl: user.profilePictureUrl,
    }); // Log fetched user
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

// @desc    Get dashboard data for the user
// @route   GET /api/dashboard
// @access  Private
const getDashboardData = asyncHandler(async (req, res) => { // Use asyncHandler
  try {
    const userId = req.user._id;

    // Count total videos analyzed
    const totalVideosAnalyzed = await Video.countDocuments({ userId });

    // Calculate average overall score
    const analyzedVideos = await Video.find({ userId, 'analysis.overallScore': { $ne: null } });
    let averageOverallScore = 0;
    if (analyzedVideos.length > 0) {
      const sumScores = analyzedVideos.reduce((acc, video) => acc + video.analysis.overallScore, 0);
      averageOverallScore = sumScores / analyzedVideos.length;
    }

    // Get latest analysis date
    const latestVideo = await Video.findOne({ userId }).sort({ uploadDate: -1 });
    const latestAnalysisDate = latestVideo ? latestVideo.uploadDate : null;

    // Get some recent feedback highlights
    const recentFeedback = await Video.find({ userId, 'analysis.grammarFeedback': { $ne: null } })
      .sort({ uploadDate: -1 })
      .limit(3)
      .select('analysis.grammarFeedback analysis.fluencyFeedback');

    res.json({
      totalVideosAnalyzed,
      averageOverallScore,
      latestAnalysisDate,
      recentFeedback,
      // Add more data as needed for your dashboard (e.g., charts data)
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error fetching dashboard data.' });
  }
});

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
// controllers/userController.js
const updateProfile = asyncHandler(async (req, res) => {
  const { username, email, password, bio, profilePictureUrl } = req.body;
  console.log('DEBUG: Received req.body in updateProfile:', req.body); // Log entire request body

  const user = await User.findById(req.user._id);

  if (user) {
    user.username = username || user.username;
    user.email = email || user.email;
    user.bio = bio || user.bio;
    user.profilePictureUrl = profilePictureUrl || user.profilePictureUrl;
    console.log('DEBUG: Updating user with profilePictureUrl:', profilePictureUrl); // Log specific field

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
    }); // Log saved user

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