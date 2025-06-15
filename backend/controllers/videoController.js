// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('express-async-handler');

// Placeholder for your speech analysis API integration
const analyzeSpeech = async (videoFilePath) => {
  try {
    console.log(`Simulating speech analysis for: ${videoFilePath}`);
    const dummyTranscription = "Hello, my name is John, and I am learning to speak more effectively. This is a very good opportunity for me.";

    const analysisData = {
      overallScore: Math.floor(Math.random() * 40) + 60,
      grammarErrors: [
        { message: "Incorrect preposition usage.", text: "'learning too speak' should be 'learning to speak'." },
        { message: "Minor run-on sentence.", text: "This is a very good opportunity for me." }
      ],
      fillerWords: ['um', 'uh'],
      speakingRate: Math.floor(Math.random() * 50) + 120,
      fluencyFeedback: "Generally fluent, but consider reducing 'um' and 'uh' for smoother delivery.",
      sentiment: "Positive",
    };

    return analysisData;

  } catch (error) {
    console.error('Error during speech analysis simulation:', error);
    throw new Error('Failed to analyze speech: ' + error.message);
  }
};

// @desc    Upload a video for analysis
// @route   POST /api/upload
// @access  Private
const uploadVideo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No video file uploaded.');
  }

  // Extract videoName from req.body
  const { videoName } = req.body; // <--- NEW: Get videoName from request body
  
  const { originalname, filename, path: filePath } = req.file;
  const userId = req.user._id;
  const videoUrl = `https://comm-analyzer.onrender.com/${filePath.replace(/\\/g, '/')}`;

  let newVideoRecord;
  try {
    newVideoRecord = await Video.create({
      userId,
      filename: originalname, // Still save original filename to Video model
      filePath: filePath.replace(/\\/g, '/'),
      status: 'uploaded',
    });
  } catch (dbError) {
    console.error('Error saving raw video record to DB:', dbError);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500);
    throw new Error('Server error: Could not record video upload.');
  }

  res.status(202).json({
    message: 'Video uploaded successfully. Analysis in progress.',
    videoRecordId: newVideoRecord ? newVideoRecord._id : null,
  });

  try {
    const analysisResult = await analyzeSpeech(filePath);

    const newAnalysis = await Analysis.create({
      userId: userId,
      videoUrl: videoUrl,
      videoPath: filePath.replace(/\\/g, '/'),
      videoName: videoName || originalname, // <--- UPDATED: Use provided name or fallback to original
      date: new Date(),
      overallScore: analysisResult.overallScore,
      grammarErrors: analysisResult.grammarErrors,
      fillerWords: analysisResult.fillerWords,
      speakingRate: analysisResult.speakingRate,
      fluencyFeedback: analysisResult.fluencyFeedback,
      sentiment: analysisResult.sentiment,
    });

    if (newVideoRecord) {
      newVideoRecord.status = 'analyzed';
      newVideoRecord.analysisId = newAnalysis._id;
      await newVideoRecord.save();
    }

    console.log(`Analysis complete and saved for video: ${videoName || originalname}. Analysis ID: ${newAnalysis._id}`);

  } catch (analysisError) {
    console.error(`Error analyzing or saving analysis for video ${originalname}:`, analysisError);
    if (newVideoRecord) {
      newVideoRecord.status = 'failed';
      await newVideoRecord.save();
    }
  }
});

// @desc    Get all videos for a logged-in user
// @route   GET /api/user/videos
// @access  Private
const getUserVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ userId: req.user._id }).sort({ uploadDate: -1 });
  res.status(200).json({ videos });
});

module.exports = {
  uploadVideo,
  getUserVideos,
};
