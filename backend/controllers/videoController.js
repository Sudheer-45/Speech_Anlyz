// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { AssemblyAI } = require('assemblyai');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

let assemblyAIClient;
if (process.env.ASSEMBLYAI_API_KEY) {
    assemblyAIClient = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
    console.log('AssemblyAI client initialized.');
} else {
    console.error('ASSEMBLYAI_API_KEY not set.');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const analyzeGrammar = asyncHandler(async (text) => {
    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        const data = await response.json();
        const score = Math.max(0, 100 - data.matches.length * 5);
        return { score, issues: data.matches };
    } catch (error) {
        console.error('[LanguageTool] error:', error.message);
        return { score: 80, issues: [] };
    }
});

const transcribeAudio = asyncHandler(async (videoUrl) => {
    if (!assemblyAIClient) return '[Transcription Failed: Client not ready]';
    try {
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio_url: videoUrl,
            punctuate: true,
            format_text: true,
        });
        return transcript.status === 'completed' ? transcript.text : `[Transcription Failed: ${transcript.status}]`;
    } catch (error) {
        return `[Transcription Failed: ${error.message}]`;
    }
});

const analyzeSpeechWithGemini = asyncHandler(async (transcription) => {
    if (!GEMINI_API_KEY) return {
        overallScore: 0,
        fillerWords: [],
        speakingRate: 0,
        fluencyFeedback: 'LLM not configured.',
        sentiment: 'Neutral',
        areasForImprovement: []
    };

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Analyze the following transcription:
    JSON: {
      "overallScore": number,
      "fillerWords": string[],
      "speakingRate": number,
      "fluencyFeedback": string,
      "sentiment": "Positive"|"Negative"|"Neutral",
      "areasForImprovement": string[]
    }
    Transcription: "${transcription}"`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 800 }
        })
    });
    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(jsonText);
});

const runAnalysisPipeline = asyncHandler(async (id, url, userId, originalname, videoName, publicId) => {
    const video = await Video.findById(id);
    if (!video) return;

    video.status = 'analyzing';
    video.analysisStartedAt = new Date();
    await video.save();

    const transcription = await transcribeAudio(url);
    if (transcription.startsWith('[Transcription Failed')) throw new Error(transcription);

    const grammar = await analyzeGrammar(transcription);
    const gemini = await analyzeSpeechWithGemini(transcription);

    const analysis = await Analysis.create({
        userId,
        videoRecordId: id,
        videoUrl: url,
        videoPath: publicId,
        videoName: videoName || originalname,
        date: new Date(),
        transcription,
        overallScore: gemini.overallScore,
        grammarErrors: grammar.issues.map(issue => ({
            message: issue.message,
            text: issue.context.text,
            offset: issue.context.offset,
            length: issue.context.length,
            replacements: issue.replacements.map(rep => rep.value)
        })),
        fillerWords: gemini.fillerWords,
        speakingRate: gemini.speakingRate,
        fluencyFeedback: gemini.fluencyFeedback,
        sentiment: gemini.sentiment,
        areasForImprovement: gemini.areasForImprovement,
    });

    video.status = 'analyzed';
    video.analysisId = analysis._id;
    video.analysisCompletedAt = new Date();
    await video.save();
});

const uploadVideo = asyncHandler(async (req, res) => {
    if (!req.file?.buffer) throw new Error('No video file buffer received.');

    const { originalname, buffer } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    const publicId = `video-${userId}-${Date.now()}`;
    const notificationUrl = `${process.env.RENDER_BACKEND_URL}/api/analysis/cloudinary-webhook`;

    const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            folder: 'comm-analyzer/videos',
            resource_type: 'video',
            public_id: publicId,
            async: true,
            eager_async: true,
            format: 'mp4',
            notification_url: notificationUrl
        }, (error, result) => {
            if (error) reject(error); else resolve(result);
        }).end(buffer);
    });

    const video = await Video.create({
        userId,
        filename: originalname,
        videoName: videoName || originalname,
        publicId,
        videoUrl: uploadResult.secure_url,
        status: 'uploading',
        uploadStartedAt: new Date(),
    });

    res.status(202).json({
        message: 'Video uploaded. Analysis will begin shortly.',
        videoRecordId: video._id,
        videoUrl: video.videoUrl,
        videoName: video.videoName,
        publicId: video.publicId,
        status: video.status
    });
});

const getUserVideos = asyncHandler(async (req, res) => {
    const videos = await Video.find({ userId: req.user._id }).sort({ uploadStartedAt: -1 });
    res.status(200).json({ videos });
});

const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
    const rawBody = req.rawBody;
    const signature = req.headers['x-cld-signature'];
    const timestamp = req.headers['x-cld-timestamp'];

    if (!signature || !timestamp || !rawBody) return res.status(400).send('Missing headers or raw body.');

    const expectedSig = crypto.createHash('sha1')
        .update(`timestamp=${timestamp}${rawBody}${process.env.CLOUDINARY_API_SECRET}`)
        .digest('hex');

    if (signature !== expectedSig) {
        console.warn('Cloudinary webhook signature mismatch');
        return res.status(200).send('Invalid signature');
    }

    const { public_id, secure_url, status } = req.body;
    const video = await Video.findOne({ publicId: public_id });
    if (!video) return res.status(404).send('Video not found.');

    if (status === 'completed' && secure_url) {
        video.videoUrl = secure_url;
        video.status = 'processed';
        video.processingCompletedAt = new Date();
        await video.save();

        runAnalysisPipeline(video._id, secure_url, video.userId, video.filename, video.videoName, public_id);
        return res.status(200).send('Webhook processed. Analysis started.');
    } else if (status === 'failed') {
        video.status = 'failed';
        video.errorMessage = 'Cloudinary processing failed.';
        await video.save();
        return res.status(200).send('Webhook processed. Video failed.');
    }

    res.status(200).send('Unhandled webhook status.');
});

const checkVideoStatus = asyncHandler(async (req, res) => {
    const video = await Video.findById(req.params.videoId);
    if (!video) return res.status(404).send('Video not found');
    if (video.userId.toString() !== req.user._id.toString()) return res.status(403).send('Unauthorized');

    let analysisData = null;
    if (video.analysisId && ['analyzed', 'failed'].includes(video.status)) {
        analysisData = await Analysis.findById(video.analysisId);
    }

    res.status(200).json({
        _id: video._id,
        videoName: video.videoName,
        status: video.status,
        errorMessage: video.errorMessage || null,
        uploadStartedAt: video.uploadStartedAt,
        videoUrl: video.videoUrl,
        analysisId: video.analysisId,
        analysisData
    });
});

module.exports = {
    uploadVideo,
    getUserVideos,
    handleCloudinaryWebhook,
    checkVideoStatus
};
