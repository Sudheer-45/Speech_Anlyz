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
    videoName: {
        type: String,
        required: true,
    },
    publicId: {
        type: String,
        required: true,
        unique: true
    },
    videoUrl: {
        type: String,
    },
    status: {
        type: String,
        enum: ['uploading', 'processing', 'ready', 'analyzed', 'failed'],
        default: 'uploading'
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },
    analysisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Analysis',
    },
    errorMessage: {
        type: String,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Video', VideoSchema);
