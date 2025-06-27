// backend/routes/analysisRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import all necessary controllers from analysisController.js
const {
    getMyAnalyses,
    getAnalysis,
    getAnalysisByVideoId,
    deleteAnalysis,
    getDashboardSummary,
    getRecentAnalyses,
} = require('../controllers/analysisController');

// Import the Cloudinary webhook handler from videoController.js
const { handleCloudinaryWebhook } = require('../controllers/videoController');

// Get all analyses for the authenticated user
router.get('/my-analyses', protect, getMyAnalyses);

// Get a specific analysis by its ID
router.get('/:id', protect, getAnalysis);

// Get analysis by a video record ID (used for checking analysis status from upload)
router.get('/video/:videoId', protect, getAnalysisByVideoId);

// Delete an analysis by ID (now handles Cloudinary deletion)
router.delete('/:id', protect, deleteAnalysis);

// --- NEW DASHBOARD ROUTES ---
// Get dashboard summary statistics
router.get('/summary', protect, getDashboardSummary);

// Get recent analyses
router.get('/recent', protect, getRecentAnalyses);

// --- CLOUDINARY WEBHOOK ROUTE ---
// This route must be publicly accessible by Cloudinary's servers
router.post('/cloudinary-webhook', handleCloudinaryWebhook);

module.exports = router;
