const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  // Added index for faster queries
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
    publicId: {
        type: String,
        required: false,
        index: true  // Important for webhook lookups
    },
    videoUrl: {
        type: String,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\..+/.test(v);
            },
            message: props => `${props.value} is not a valid URL!`
        }
    },
    status: {
        type: String,
        enum: ['uploading', 'processing', 'processed', 'analyzing', 'analyzed', 'failed'],
        default: 'uploading',
        index: true,
        required: true
    },
    analysisId: {
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
    // New fields for better tracking
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

// Virtual for processing duration
VideoSchema.virtual('processingDuration').get(function() {
    if (this.processingStartedAt && this.processingCompletedAt) {
        return (this.processingCompletedAt - this.processingStartedAt) / 1000;
    }
    return null;
});

// Virtual for analysis duration
VideoSchema.virtual('analysisDuration').get(function() {
    if (this.analysisStartedAt && this.analysisCompletedAt) {
        return (this.analysisCompletedAt - this.analysisStartedAt) / 1000;
    }
    return null;
});

// Indexes
VideoSchema.index({ publicId: 1, status: 1 });
VideoSchema.index({ status: 1, createdAt: -1 });
VideoSchema.index({ userId: 1, status: 1 });

// Middleware to update timestamps based on status changes
VideoSchema.pre('save', function(next) {
    const statusChanges = {
        'processing': 'processingStartedAt',
        'processed': 'processingCompletedAt',
        'analyzing': 'analysisStartedAt',
        'analyzed': 'analysisCompletedAt'
    };

    if (this.isModified('status') && statusChanges[this.status]) {
        this[statusChanges[this.status]] = new Date();
    }

    if (this.isModified('status') && this.status === 'failed') {
        this.retryCount += 1;
    }

    next();
});

module.exports = mongoose.model('Video', VideoSchema);
