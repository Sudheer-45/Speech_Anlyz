// backend/controllers/analysisController.js
const Analysis = require('../models/Analysis');
const Video = require('../models/Video'); // Assuming you have a Video model
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2; // Import Cloudinary

// Configure Cloudinary (ensure environment variables are set in Render)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// @desc    Get all analyses for the authenticated user
// @route   GET /api/analysis/my-analyses
// @access  Private
const getMyAnalyses = asyncHandler(async (req, res) => {
    const analyses = await Analysis.find({ userId: req.user._id }).sort({ date: -1 }); // Sort by newest first
    res.json(analyses);
});

// @desc    Get analysis by ID
// @route   GET /api/analysis/:id
// @access  Private
const getAnalysis = asyncHandler(async (req, res) => {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
        res.status(404);
        throw new Error('Analysis not found');
    }

    // Ensure the analysis belongs to the authenticated user
    if (analysis.userId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this analysis');
    }

    res.status(200).json(analysis);
});

// @desc    Get analysis by video record ID
// @route   GET /api/analysis/video/:videoId
// @access  Private
const getAnalysisByVideoId = asyncHandler(async (req, res) => {
    // Validate videoId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.videoId)) {
        res.status(400);
        throw new Error('Invalid video ID format');
    }

    // Find the analysis linked to this videoRecordId
    const analysis = await Analysis.findOne({ videoRecordId: req.params.videoId });

    if (!analysis) {
        // Check if the video exists but analysis is still pending/failed
        const video = await Video.findById(req.params.videoId);
        if (video) {
            // If video exists and belongs to user, but no analysis found or still processing
            if (video.userId.toString() !== req.user._id.toString()) {
                res.status(403);
                throw new Error('Not authorized to view analysis for this video');
            }
            // Return video status if analysis is not yet complete
            return res.status(200).json({ status: video.status, message: `Analysis for this video is ${video.status}. Please check back later.` });
        } else {
            res.status(404);
            throw new Error('Video or analysis not found');
        }
    }

    // Ensure the analysis belongs to the authenticated user
    if (analysis.userId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this analysis');
    }

    // If analysis is found and authorized, return it
    res.status(200).json(analysis);
});

// @desc    Delete an analysis and its associated Cloudinary video
// @route   DELETE /api/analysis/:id
// @access  Private
const deleteAnalysis = asyncHandler(async (req, res) => {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
        res.status(404);
        throw new Error('Analysis not found');
    }

    // Ensure the logged-in user owns the analysis
    if (analysis.userId.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to delete this analysis');
    }

    // Attempt to delete the associated video from Cloudinary
    // The public_id is stored in analysis.filePath (or analysis.videoPath from older schema)
    const cloudinaryPublicId = analysis.videoPath || analysis.filePath; // Use filePath from newer schema, fallback to videoPath
    if (cloudinaryPublicId) {
        try {
            console.log(`Attempting to delete video from Cloudinary: ${cloudinaryPublicId}`);
            const result = await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' });
            console.log('Cloudinary deletion result:', result);
            if (result.result !== 'ok' && result.result !== 'not found') {
                console.warn(`Cloudinary deletion for ${cloudinaryPublicId} did not return 'ok' or 'not found'. Result: ${result.result}`);
                // Don't throw error here, allow analysis to be deleted from DB
            }
        } catch (cloudinaryErr) {
            console.error(`Error deleting video from Cloudinary (${cloudinaryPublicId}):`, cloudinaryErr);
            // Don't block DB deletion even if Cloudinary fails
        }
    } else {
        console.warn('No Cloudinary public ID found for analysis:', analysis._id, 'Skipping Cloudinary deletion.');
    }

    // If there's a linked Video record, update its status or delete it
    if (analysis.videoRecordId) {
        try {
            const videoRecord = await Video.findById(analysis.videoRecordId);
            if (videoRecord && videoRecord.userId.toString() === req.user._id.toString()) { // Ensure ownership
                await videoRecord.deleteOne(); // Delete the associated video record
                console.log(`Associated Video record ${analysis.videoRecordId} deleted successfully.`);
            }
        } catch (videoRecordErr) {
            console.error(`Error deleting associated Video record ${analysis.videoRecordId}:`, videoRecordErr);
        }
    }

    await analysis.deleteOne(); // Delete the analysis record from DB

    res.json({ message: 'Analysis and associated video removed' });
});

// @desc    Get dashboard summary statistics for the authenticated user
// @route   GET /api/analysis/summary
// @access  Private
const getDashboardSummary = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Fetch all completed analyses for the user
    // Filter for 'analyzed' status if you only want successfully analyzed videos in summary
    const userAnalyses = await Analysis.find({ userId: userId }).sort({ date: 1 }); // Sort by date ascending for trend calculation

    if (userAnalyses.length === 0) {
        return res.status(200).json({
            totalVideos: 0,
            averageOverallScore: 0,
            averageSpeakingRate: 0,
            mostCommonFillerWord: null,
            scoreTrend: 'N/A',
            speakingRateConsistency: 'N/A',
            fillerWordTrend: 'N/A'
        });
    }

    const totalVideos = userAnalyses.length;
    let totalOverallScore = 0;
    let totalSpeakingRate = 0;
    const allFillerWords = [];

    userAnalyses.forEach(analysis => {
        if (typeof analysis.overallScore === 'number') {
            totalOverallScore += analysis.overallScore;
        }
        if (typeof analysis.speakingRate === 'number') {
            totalSpeakingRate += analysis.speakingRate;
        }
        if (Array.isArray(analysis.fillerWords)) {
            allFillerWords.push(...analysis.fillerWords.filter(word => typeof word === 'string' && word.trim() !== '')); // Filter out empty strings
        }
    });

    const averageOverallScore = totalOverallScore / totalVideos;
    const averageSpeakingRate = totalSpeakingRate / totalVideos;

    // Calculate most common filler word
    const fillerWordCounts = {};
    allFillerWords.forEach(word => {
        const lowerCaseWord = word.toLowerCase();
        fillerWordCounts[lowerCaseWord] = (fillerWordCounts[lowerCaseWord] || 0) + 1;
    });

    let mostCommonFillerWord = null;
    let maxCount = 0;
    for (const word in fillerWordCounts) {
        if (fillerWordCounts[word] > maxCount) {
            maxCount = fillerWordCounts[word];
            mostCommonFillerWord = word;
        }
    }

    // Simple trend analysis: Compare first few vs last few analyses
    let scoreTrend = 'Stable';
    if (userAnalyses.length >= 3) { // Need at least 3 for a basic trend
        const thirdLength = Math.floor(userAnalyses.length / 3);
        const firstFewAvg = userAnalyses.slice(0, thirdLength)
                                       .reduce((sum, a) => sum + (a.overallScore || 0), 0) / thirdLength;
        const lastFewAvg = userAnalyses.slice(-thirdLength)
                                      .reduce((sum, a) => sum + (a.overallScore || 0), 0) / thirdLength;
        
        // Define a small threshold for change to be considered a "trend"
        const trendThreshold = 2; // e.g., a 2-point average change

        if (lastFewAvg > firstFewAvg + trendThreshold) {
            scoreTrend = 'improving';
        } else if (lastFewAvg < firstFewAvg - trendThreshold) {
            scoreTrend = 'declining';
        }
    }

    // Speaking Rate Consistency (example: check if avg speaking rate is within a "good" range)
    let speakingRateConsistency = 'Needs Focus';
    if (averageSpeakingRate > 100 && averageSpeakingRate < 160) { // Common range for clear speech (WPM)
        speakingRateConsistency = 'consistent';
    }

    // Filler Word Trend (example: check if average filler words per analysis are decreasing)
    let fillerWordTrend = 'Needs Focus';
    if (userAnalyses.length >= 3) {
        const thirdLength = Math.floor(userAnalyses.length / 3);
        const firstFewFillerCount = userAnalyses.slice(0, thirdLength)
                                                .reduce((sum, a) => sum + (a.fillerWords ? a.fillerWords.length : 0), 0) / thirdLength;
        const lastFewFillerCount = userAnalyses.slice(-thirdLength)
                                               .reduce((sum, a) => sum + (a.fillerWords ? a.fillerWords.length : 0), 0) / thirdLength;
        
        const fillerTrendThreshold = 1; // e.g., average 1 fewer filler word

        if (lastFewFillerCount < firstFewFillerCount - fillerTrendThreshold) {
            fillerWordTrend = 'reducing';
        } else if (lastFewFillerCount > firstFewFillerCount + fillerTrendThreshold) {
            fillerWordTrend = 'increasing'; // Optionally show if increasing
        }
    }


    res.status(200).json({
        totalVideos,
        averageOverallScore: averageOverallScore || 0,
        averageSpeakingRate: averageSpeakingRate || 0,
        mostCommonFillerWord,
        scoreTrend,
        speakingRateConsistency,
        fillerWordTrend
    });
});

// @desc    Get recent analyses for the authenticated user
// @route   GET /api/analysis/recent
// @access  Private
const getRecentAnalyses = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // Fetch last 5 successfully analyzed analyses, sorted by date descending
    const recentAnalyses = await Analysis.find({ userId: userId })
                                        .sort({ date: -1 })
                                        .limit(5); // Adjust limit as needed

    res.status(200).json({ recentAnalyses });
});


module.exports = {
    getMyAnalyses, // This was already present
    getAnalysis,
    getAnalysisByVideoId,
    deleteAnalysis, // This was already present (now updated for Cloudinary)
    getDashboardSummary, // New
    getRecentAnalyses,   // New
};
