// backend/models/Video.js
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: { // Original name of the uploaded video file
      type: String,
      required: true,
    },
    // This `videoUrl` field will now store the persistent Cloudinary URL for the video
    videoUrl: {
      type: String,
      required: true,
    },
    // `filePath` can be kept as a duplicate of videoUrl for consistency or removed if not strictly needed
    // For now, we'll make it store the Cloudinary URL too, just to avoid breaking existing code
    filePath: { 
      type: String,
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    // Status of the video processing (e.g., 'uploaded', 'processing', 'analyzed', 'failed')
    status: {
      type: String,
      default: 'uploaded',
    },
    // Reference to the associated Analysis document, for retrieving detailed results
    analysisId: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Analysis',
      required: false, // Not required immediately after upload, only after analysis
    },
    // Field to store any error messages during analysis or processing
    errorMessage: {
      type: String,
      required: false,
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

module.exports = mongoose.model('Video', VideoSchema);
