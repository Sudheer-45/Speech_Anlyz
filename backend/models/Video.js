const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  filePath: { // Path to the stored video file
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  analysis: {
    // This will store the detailed analysis results from your AI API
    // Example structure, adapt based on your chosen API's output
    overallScore: { type: Number, default: null },
    grammarFeedback: { type: String, default: null },
    fluencyFeedback: { type: String, default: null },
    vocabularyFeedback: { type: String, default: null },
    conversationalSkillsFeedback: { type: String, default: null },
    sentiment: { type: String, default: null },
    // You might also store raw API response if useful for debugging/detailed view
    rawAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  status: { // e.g., 'uploaded', 'processing', 'analyzed', 'failed'
    type: String,
    default: 'uploaded',
  },
});

module.exports = mongoose.model('Video', VideoSchema);