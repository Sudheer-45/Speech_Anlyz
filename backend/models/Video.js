// backend/models/Video.js
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  filename: {
    type: String,
    required: true,
    trim: true
  },
  videoName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Video name cannot exceed 100 characters']
  },
  cloudinaryPublicId: {
    type: String,
    required: false,
    index: true
  },
  videoUrl: {
    type: String,
    validate: {
      validator: v => /^https?:\/\/.+\..+/.test(v),
      message: props => `${props.value} is not a valid URL!`
    }
  },
  status: {
    type: String,
    enum: ['Cloudinary Uploading', 'Analyzing', 'Completed', 'Failed'],
    default: 'Cloudinary Uploading',
    required: true,
    index: true
  },
  analysis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Analysis'
  },
  errorMessage: {
    type: String,
    trim: true
  },
  bytes: {
    type: Number,
    min: [0, 'File size cannot be negative']
  },
  mimetype: {
    type: String,
    enum: [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-flv',
      'video/3gpp'
    ]
  },
  uploadStartedAt: {
    type: Date,
    default: Date.now
  },
  processingStartedAt: Date,
  processingCompletedAt: Date,
  analysisStartedAt: Date,
  analysisCompletedAt: Date,
  lastCheckedAt: {
    type: Date,
    default: Date.now
  },
  retryCount: {
    type: Number,
    default: 0,
    max: [5, 'Maximum retries exceeded']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
VideoSchema.virtual('processingDuration').get(function () {
  if (this.processingStartedAt && this.processingCompletedAt) {
    return (this.processingCompletedAt - this.processingStartedAt) / 1000;
  }
  return null;
});

VideoSchema.virtual('analysisDuration').get(function () {
  if (this.analysisStartedAt && this.analysisCompletedAt) {
    return (this.analysisCompletedAt - this.analysisStartedAt) / 1000;
  }
  return null;
});

// Indexes
VideoSchema.index({ cloudinaryPublicId: 1, status: 1 });
VideoSchema.index({ status: 1, createdAt: -1 });
VideoSchema.index({ user: 1, status: 1 });

// Middleware to set timestamps on status change
VideoSchema.pre('save', function (next) {
  const statusTimestamps = {
    'Analyzing': 'analysisStartedAt',
    'Completed': 'analysisCompletedAt'
  };

  if (this.isModified('status') && statusTimestamps[this.status]) {
    this[statusTimestamps[this.status]] = new Date();
  }

  if (this.isModified('status') && this.status === 'Failed') {
    this.retryCount += 1;
  }

  next();
});

module.exports = mongoose.model('Video', VideoSchema);
