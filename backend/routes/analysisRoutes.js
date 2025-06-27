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

// --- IMPORTANT: Place more specific routes BEFORE general ID routes ---

// NEW DASHBOARD ROUTES (Specific)
router.get('/summary', protect, getDashboardSummary);
router.get('/recent', protect, getRecentAnalyses);

// Get all analyses for the authenticated user (Specific static route)
router.get('/my-analyses', protect, getMyAnalyses);

// Get analysis by a video record ID (Specific dynamic route)
// This must be before '/:id' because it also uses a dynamic parameter
router.get('/video/:videoId', protect, getAnalysisByVideoId);

// Get a specific analysis by its ID (General dynamic route - LAST among GETs)
router.get('/:id', protect, getAnalysis);

// Delete an analysis by ID (General dynamic route - remains here as it's a DELETE)
router.delete('/:id', protect, deleteAnalysis);

// CLOUDINARY WEBHOOK ROUTE (remains public, typically separate or early in main app.js)
// If this is mounted under /api, then the full path will be /api/cloudinary-webhook
router.post('/cloudinary-webhook', handleCloudinaryWebhook);

module.exports = router;
