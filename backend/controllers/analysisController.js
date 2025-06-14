// backend/controllers/analysisController.js
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const fs = require('fs'); // For file system operations (to delete video file)
const path = require('path'); // For path manipulation

// @desc    Get all analyses for the authenticated user
// @route   GET /api/analysis/my-analyses
// @access  Private
const getMyAnalyses = asyncHandler(async (req, res) => {
  const analyses = await Analysis.find({ userId: req.user.id }).sort({ date: -1 }); // Sort by newest first
  res.json(analyses);
});

// @desc    Delete an analysis
// @route   DELETE /api/analysis/:id
// @access  Private
const deleteAnalysis = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findById(req.params.id);

  if (!analysis) {
    res.status(404);
    throw new Error('Analysis not found');
  }

  // Ensure the logged-in user owns the analysis
  if (analysis.userId.toString() !== req.user.id) {
    res.status(401);
    throw new Error('Not authorized to delete this analysis');
  }

  // Optional: Delete the associated video file from the server
  if (analysis.videoPath) {
    const filePath = path.join(__dirname, '..', analysis.videoPath); // Construct full path
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting video file at ${filePath}:`, err);
        // You might choose to throw an error here, but typically,
        // we'd still want the analysis record deleted even if file deletion fails.
      } else {
        console.log(`Video file ${filePath} deleted successfully.`);
      }
    });
  }

  await analysis.deleteOne(); // Use deleteOne() or remove() depending on Mongoose version

  res.json({ message: 'Analysis removed' });
});

module.exports = {
  getMyAnalyses,
  deleteAnalysis,
};