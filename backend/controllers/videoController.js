const cloudinary = require('cloudinary').v2;
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const fetch = require('node-fetch');

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// AssemblyAI setup
const { AssemblyAI } = require('assemblyai');
const assemblyAIClient = process.env.ASSEMBLYAI_API_KEY 
    ? new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY })
    : null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Helper Functions
const analyzeGrammar = async (text) => {
    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        
        if (!response.ok) throw new Error(`LanguageTool API error: ${response.status}`);
        
        const data = await response.json();
        const score = Math.max(0, 100 - data.matches.length * 5);
        return { score, issues: data.matches };
    } catch (error) {
        console.error('LanguageTool error:', error);
        return { score: 80, issues: [] };
    }
};

const transcribeAudio = async (videoUrl) => {
    if (!assemblyAIClient) {
        throw new Error('AssemblyAI client not initialized');
    }

    try {
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio_url: videoUrl,
            punctuate: true,
            format_text: true,
        });

        if (transcript.status !== 'completed') {
            throw new Error(`Transcription failed with status: ${transcript.status}`);
        }
        return transcript.text;
    } catch (error) {
        console.error('Transcription error:', error);
        throw new Error(`Transcription failed: ${error.message}`);
    }
};

const analyzeSpeechWithGemini = async (transcription) => {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ 
                        parts: [{ 
                            text: `Analyze this speech: "${transcription}"` 
                        }] 
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        // Parse and return the analysis results
        return parseGeminiResponse(result);
    } catch (error) {
        console.error('Gemini analysis error:', error);
        throw new Error(`Gemini analysis failed: ${error.message}`);
    }
};

const parseGeminiResponse = (result) => {
    // Implement your specific response parsing logic here
    return {
        overallScore: 85,
        fillerWords: ['um', 'ah'],
        speakingRate: 150,
        fluencyFeedback: 'Good overall fluency',
        sentiment: 'Positive',
        areasForImprovement: ['Reduce filler words', 'Improve pacing']
    };
};

// Controller Functions
const uploadVideo = asyncHandler(async (req, res) => {
    if (!req.file?.buffer) {
        return res.status(400).json({ error: 'No video file received' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    try {
        // Create initial video record
        const videoRecord = await Video.create({
            userId,
            filename: originalname,
            videoName: videoName || originalname,
            status: 'uploading',
            mimetype
        });

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: `comm-analyzer/videos/${videoRecord._id}`,
                    notification_url: `${process.env.BACKEND_URL}/api/webhooks/cloudinary`,
                    eager: [{ format: 'mp4', quality: 'auto' }],
                    eager_async: true,
                    chunk_size: 6000000
                },
                (error, result) => error ? reject(error) : resolve(result)
            );
            uploadStream.end(buffer);
        });

        // Update with initial Cloudinary info
        await Video.findByIdAndUpdate(videoRecord._id, {
            publicId: uploadResult.public_id,
            status: 'processing'
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
            details: error.message 
        });
    }
});

const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
    try {
        // Verify signature
        const signature = crypto
            .createHash('sha1')
            .update(JSON.stringify(req.body) + process.env.CLOUDINARY_API_SECRET)
            .digest('hex');
        
        if (signature !== req.headers['x-cld-signature']) {
            return res.status(401).send('Unauthorized');
        }

        const { public_id, eager } = req.body;
        if (!eager?.[0]?.secure_url) {
            return res.status(400).send('Missing video URL');
        }

        // Update video record
        const video = await Video.findOneAndUpdate(
            { publicId: public_id },
            { 
                status: 'processed',
                videoUrl: eager[0].secure_url 
            },
            { new: true }
        );

        if (!video) return res.status(404).send('Video not found');

        // Start analysis
        try {
            const transcription = await transcribeAudio(video.videoUrl);
            const grammar = await analyzeGrammar(transcription);
            const geminiAnalysis = await analyzeSpeechWithGemini(transcription);

            const analysis = await Analysis.create({
                videoRecordId: video._id,
                userId: video.userId,
                transcription,
                ...geminiAnalysis,
                grammarScore: grammar.score,
                grammarIssues: grammar.issues
            });

            await Video.findByIdAndUpdate(video._id, {
                status: 'analyzed',
                analysisId: analysis._id
            });

        } catch (analysisError) {
            await Video.findByIdAndUpdate(video._id, {
                status: 'failed',
                errorMessage: analysisError.message
            });
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal server error');
    }
});

const checkVideoStatus = asyncHandler(async (req, res) => {
    try {
        const video = await Video.findById(req.params.videoId)
            .populate('analysisId', '-__v');
        
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json({
            status: video.status,
            videoUrl: video.videoUrl,
            analysis: video.analysisId,
            error: video.errorMessage
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check status' });
    }
});

const getUserVideos = asyncHandler(async (req, res) => {
    try {
        const videos = await Video.find({ userId: req.user._id })
            .sort('-createdAt')
            .select('filename videoName status createdAt')
            .limit(20);
            
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

module.exports = {
    uploadVideo,
    handleCloudinaryWebhook,
    checkVideoStatus,
    getUserVideos
};
