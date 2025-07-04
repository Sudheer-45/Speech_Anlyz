// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const { AssemblyAI } = require('assemblyai');
const { validateVideoUpload } = require('../validators/videoValidator');
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize AssemblyAI client
let assemblyAIClient;
if (process.env.ASSEMBLYAI_API_KEY) {
  assemblyAIClient = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY,
  });
  logger.info('AssemblyAI client initialized');
} else {
  logger.warn('ASSEMBLYAI_API_KEY not set - Speech-to-Text disabled');
}

// Constants
const ANALYSIS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const VIDEO_STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

// Helper Functions
const validateCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration missing');
  }
};

const validateWebhookUrl = () => {
  if (!process.env.RENDER_BACKEND_URL) {
    throw new Error('RENDER_BACKEND_URL not configured');
  }
};

// Core Analysis Functions
const analyzeGrammar = async (text) => {
  try {
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}&language=en-US`
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LanguageTool API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const score = Math.max(0, 100 - data.matches.length * 5);
    
    return {
      score,
      issues: data.matches.map(match => ({
        message: match.message,
        context: match.context,
        replacements: match.replacements
      }))
    };
  } catch (error) {
    logger.error('Grammar analysis failed', error);
    return { score: 80, issues: [] }; // Fallback
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
    logger.error('Audio transcription failed', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

const analyzeWithGemini = async (transcription) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `Analyze this speech transcript and provide structured JSON output:
  {
    "overallScore": number (1-100),
    "fillerWords": string[],
    "speakingRate": number (words per minute),
    "fluencyFeedback": string,
    "sentiment": "positive"|"neutral"|"negative",
    "areasForImprovement": string[]
  }
  
  Transcript: "${transcription.substring(0, 5000)}"`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!analysisText) {
      throw new Error('Invalid Gemini response structure');
    }

    return JSON.parse(analysisText);
  } catch (error) {
    logger.error('Gemini analysis failed', error);
    throw new Error(`LLM analysis failed: ${error.message}`);
  }
};

// Main Controller Functions
const uploadVideo = asyncHandler(async (req, res) => {
  try {
    validateCloudinaryConfig();
    validateWebhookUrl();
    
    const { error } = validateVideoUpload(req);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { originalname, buffer, size, mimetype } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    const publicId = `video-${userId}-${Date.now()}`;
    const notificationUrl = `${process.env.RENDER_BACKEND_URL}/api/webhook`;

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'interview-analyzer/videos',
          resource_type: 'video',
          public_id: publicId,
          notification_url: notificationUrl
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      
      uploadStream.end(buffer);
    });

    const videoRecord = await Video.create({
      user: userId,
      filename: originalname,
      videoName: videoName || originalname,
      publicId: uploadResult.public_id,
      status: VIDEO_STATUS.UPLOADING,
      uploadStartedAt: new Date(),
      size,
      mimetype
    });

    res.status(202).json({
      message: 'Upload initiated',
      videoId: videoRecord._id,
      status: videoRecord.status
    });
  } catch (error) {
    logger.error('Video upload failed', error);
    res.status(500).json({ error: error.message });
  }
});

const handleWebhook = asyncHandler(async (req, res) => {
  try {
    // Validate signature
    const signature = crypto
      .createHash('sha1')
      .update(req.rawBody + process.env.CLOUDINARY_API_SECRET)
      .digest('hex');

    if (signature !== req.headers['x-cld-signature']) {
      return res.status(403).send('Invalid signature');
    }

    const { notification_type, public_id, secure_url, status } = req.body;

    if (notification_type !== 'upload') {
      return res.status(200).send('Notification type not handled');
    }

    const video = await Video.findOneAndUpdate(
      { publicId: public_id },
      { 
        videoUrl: secure_url,
        status: status === 'completed' ? VIDEO_STATUS.READY : VIDEO_STATUS.FAILED,
        processingCompletedAt: new Date()
      },
      { new: true }
    );

    if (!video) {
      return res.status(404).send('Video not found');
    }

    if (status === 'completed') {
      runAnalysisPipeline(
        video._id,
        secure_url,
        video.user,
        video.filename,
        video.videoName,
        public_id
      ).catch(err => logger.error('Analysis pipeline failed', err));
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    logger.error('Webhook processing failed', error);
    res.status(500).send('Internal server error');
  }
});

const runAnalysisPipeline = async (
  videoId, videoUrl, userId, filename, videoName, publicId
) => {
  try {
    await Video.findByIdAndUpdate(videoId, {
      status: VIDEO_STATUS.PROCESSING,
      analysisStartedAt: new Date()
    });

    const transcription = await transcribeAudio(videoUrl);
    const [grammarAnalysis, geminiAnalysis] = await Promise.all([
      analyzeGrammar(transcription),
      analyzeWithGemini(transcription)
    ]);

    const analysis = await Analysis.create({
      userId,
      videoId,
      transcription,
      ...geminiAnalysis,
      grammarScore: grammarAnalysis.score,
      grammarIssues: grammarAnalysis.issues
    });

    await Video.findByIdAndUpdate(videoId, {
      status: VIDEO_STATUS.READY,
      analysis: analysis._id,
      analysisCompletedAt: new Date()
    });

    logger.info(`Analysis completed for video ${videoId}`);
  } catch (error) {
    logger.error(`Analysis failed for video ${videoId}`, error);
    
    await Video.findByIdAndUpdate(videoId, {
      status: VIDEO_STATUS.FAILED,
      errorMessage: error.message,
      analysisCompletedAt: new Date()
    });
  }
};

const getVideos = asyncHandler(async (req, res) => {
  try {
    const videos = await Video.find({ user: req.user._id })
      .sort('-uploadStartedAt')
      .populate('analysis', '-__v');
      
    res.json(videos);
  } catch (error) {
    logger.error('Failed to fetch videos', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

const getVideo = asyncHandler(async (req, res) => {
  try {
    const video = await Video.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('analysis');

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    logger.error('Failed to fetch video', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

module.exports = {
  uploadVideo,
  handleWebhook,
  getVideos,
  getVideo
};
