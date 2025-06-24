const cloudinary = require('cloudinary').v2;
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ 
    model: "gemini-pro",
    generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.3
    }
});

// Verify critical environment variables
if (!process.env.RENDER_BACKEND_URL || !process.env.CLOUDINARY_CLOUD_NAME || !process.env.GEMINI_API_KEY) {
    throw new Error('Missing required environment variables');
}

// Enhanced Helper Functions
const analyzeGrammar = async (text) => {
    try {
        const prompt = `Analyze this text for grammar and syntax errors. Return JSON with:
        - score (0-100)
        - issues (array of errors with message, context, and suggestions)
        
        Text: ${text.substring(0, 10000)}`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        
        // Extract JSON from response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 80, issues: [] };
    } catch (error) {
        console.error('Grammar analysis error:', error);
        return { score: 80, issues: [] };
    }
};

const analyzeSpeechWithGemini = async (transcription) => {
    try {
        const prompt = `Analyze this speech transcript professionally and return JSON with:
        1. overallScore (1-100)
        2. fillerWords (array)
        3. speakingRate (words per minute)
        4. sentiment (positive/neutral/negative)
        5. fluencyFeedback (string)
        6. areasForImprovement (array of strings)
        
        Transcript: ${transcription.substring(0, 30000)}`;

        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        
        // Extract JSON from response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format');
        
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        if (!analysis.overallScore || !analysis.areasForImprovement) {
            throw new Error('Incomplete analysis data');
        }
        
        return analysis;
    } catch (error) {
        console.error('Gemini analysis error:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
};

// Controller Functions (Updated)
const uploadVideo = asyncHandler(async (req, res) => {
    if (!req.file?.buffer) {
        return res.status(400).json({ error: 'No video file received' });
    }

    try {
        const { originalname, buffer, mimetype } = req.file;
        const { videoName } = req.body;
        const userId = req.user._id;

        const tempPublicId = `temp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const videoRecord = await Video.create({
            userId,
            filename: originalname,
            videoName: videoName || originalname,
            publicId: tempPublicId,
            status: 'uploading',
            mimetype
        });

        const uploadResult = await new Promise((resolve, reject) => {
            const finalPublicId = `comm-analyzer/videos/${videoRecord._id}`;
            
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: finalPublicId,
                    notification_url: `${process.env.RENDER_BACKEND_URL}/api/webhooks/cloudinary`,
                    eager: [{ format: 'mp4', quality: 'auto' }],
                    eager_async: true,
                    chunk_size: 6000000,
                    timeout: 120000
                },
                (error, result) => error ? reject(error) : resolve(result)
            );
            uploadStream.end(buffer);
        });

        await Video.findByIdAndUpdate(videoRecord._id, {
            publicId: uploadResult.public_id,
            status: 'processing',
            bytes: uploadResult.bytes
        });

        res.status(202).json({
            message: 'Video upload started',
            videoId: videoRecord._id,
            status: 'processing'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Upload failed',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
    try {
        const signature = crypto
            .createHash('sha1')
            .update(JSON.stringify(req.body) + process.env.CLOUDINARY_API_SECRET)
            .digest('hex');
        
        if (signature !== req.headers['x-cld-signature']) {
            console.error('Invalid webhook signature');
            return res.status(401).send('Unauthorized');
        }

        const { public_id, eager } = req.body;
        const secureUrl = eager?.[0]?.secure_url;

        if (!secureUrl) {
            return res.status(400).send('Missing video URL');
        }
        
        const video = await Video.findOneAndUpdate(
            { publicId: public_id },
            { 
                status: 'processed',
                videoUrl: secureUrl,
                processingCompleteAt: new Date() 
            },
            { new: true }
        );

        if (!video) {
            return res.status(404).send('Video not found');
        }

        // Start analysis process
        processAudioToTextAnalysis(video, secureUrl)
            .catch(err => console.error('Analysis processing error:', err));

        res.status(200).send('Webhook received');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal server error');
    }
});

// New audio-to-text processing function
const processAudioToTextAnalysis = async (video, videoUrl) => {
    try {
        // Step 1: Transcribe audio using Google's Speech-to-Text
        const transcription = await transcribeAudio(videoUrl);
        
        // Step 2: Parallel analysis
        const [grammar, speechAnalysis] = await Promise.all([
            analyzeGrammar(transcription),
            analyzeSpeechWithGemini(transcription)
        ]);

        // Step 3: Save results
        const analysis = await Analysis.create({
            videoRecordId: video._id,
            userId: video.userId,
            transcription,
            ...speechAnalysis,
            grammarScore: grammar.score,
            grammarIssues: grammar.issues
        });

        await Video.findByIdAndUpdate(video._id, {
            status: 'analyzed',
            analysisId: analysis._id,
            analyzedAt: new Date()
        });

    } catch (error) {
        console.error(`Analysis failed for video ${video._id}:`, error);
        await Video.findByIdAndUpdate(video._id, {
            status: 'failed',
            errorMessage: error.message
        });
    }
};

// Mock transcription function (replace with actual Google Speech-to-Text)
const transcribeAudio = async (videoUrl) => {
    // In a real implementation, you would use:
    // 1. Google Cloud Speech-to-Text API
    // 2. Or keep AssemblyAI just for transcription if needed
    // This is a mock implementation:
    return "This is a mock transcription. In production, implement Google Speech-to-Text here.";
};

// Existing controller functions remain the same
const checkVideoStatus = asyncHandler(async (req, res) => {
    // ... existing implementation ...
});

const getUserVideos = asyncHandler(async (req, res) => {
    // ... existing implementation ...
});

module.exports = {
    uploadVideo,
    handleCloudinaryWebhook,
    checkVideoStatus,
    getUserVideos
};
