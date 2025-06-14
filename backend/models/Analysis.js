// backend/models/Analysis.js
const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to your User model
    required: true,
  },
  videoUrl: {
    type: String, // URL of the uploaded video
    required: true,
  },
  videoPath: { // Local path if stored on server, for deletion purposes
    type: String,
    required: true,
  },
  videoName: {
    type: String,
    default: 'Untitled Analysis',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  grammarErrors: [
    {
      message: String,
      text: String, // The problematic text snippet
      // Add more details like start/end time, suggestions if your AI provides
    },
  ],
  fillerWords: [String], // Array of detected filler words
  speakingRate: Number, // Words per minute
  fluencyFeedback: String, // General text feedback on fluency
  sentiment: String, // e.g., 'Positive', 'Neutral', 'Negative'
  // Add other analysis metrics as needed
  // pronunciationScore: Number,
  // vocabularySuggestions: String,
});

module.exports = mongoose.model('Analysis', AnalysisSchema);