const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    videoName: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: false // Make it optional initially
    },
    videoUrl: {
        type: String
    },
    status: {
        type: String,
        enum: ['uploading', 'processing', 'processed', 'analyzed', 'failed'],
        default: 'uploading'
    },
    analysisId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Analysis'
    },
    errorMessage: {
        type: String
    },
    bytes: {
        type: Number
    },
    mimetype: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Video', VideoSchema);
