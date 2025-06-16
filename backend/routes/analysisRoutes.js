// backend/routes/analysisRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
// Assuming getMyAnalyses and deleteAnalysis are implemented in analysisController
const { getMyAnalyses, deleteAnalysis } = require('../controllers/analysisController'); 

// Get all analyses for the authenticated user
router.get('/my-analyses', protect, getMyAnalyses);

// Delete an analysis by ID
router.delete('/:id', protect, deleteAnalysis);

module.exports = router;
