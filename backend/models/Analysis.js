// backend/models/Analysis.js
const mongoose = require('mongoose');

const AnalysisSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    videoUrl: {
        type: String, // URL of the video (will be broken if video not on persistent storage)
        required: true,
    },
    videoPath: { // Local path (temporary on Render) or reference for future cloud storage
        type: String,
        required: false,
    },
    videoName: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    transcription: { // Full transcribed text from STT
        type: String,
        required: false,
    },
    overallScore: { // From Gemini analysis
        type: Number,
        required: false,
    },
    grammarErrors: [ // From LanguageTool
        {
            message: { type: String },
            text: { type: String }, 
            offset: { type: Number }, 
            length: { type: Number }, 
            replacements: [{ type: String }], 
        },
    ],
    fillerWords: [{ // From Gemini analysis
        type: String, 
    }],
    speakingRate: { // From Gemini analysis
        type: Number, 
        required: false,
    },
    fluencyFeedback: { // From Gemini analysis
        type: String,
        required: false,
    },
    sentiment: { // From Gemini analysis
        type: String, // e.g., "Positive", "Negative", "Neutral"
        required: false,
    },
    areasForImprovement: [{ // Specific tips from Gemini LLM
        type: String,
    }],
}, {
    timestamps: true, // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Analysis', AnalysisSchema);
