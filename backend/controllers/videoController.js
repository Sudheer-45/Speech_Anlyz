const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// AssemblyAI setup
const { AssemblyAI } = require('assemblyai');

// Initialize AssemblyAI client
let assemblyAIClient;
if (process.env.ASSEMBLYAI_API_KEY) {
    assemblyAIClient = new AssemblyAI({
        apiKey: process.env.ASSEMBLYAI_API_KEY,
    });
    console.log('AssemblyAI client initialized.');
} else {
    console.error('ASSEMBLYAI_API_KEY environment variable is not set. Speech-to-Text will not function.');
}

// Gemini API key (for LLM analysis, ensure this is still set in Render as GEMINI_API_KEY)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// LanguageTool grammar analysis (No changes)
const analyzeGrammar = async (text) => {
    try {
        console.log('Sending text to LanguageTool API...');
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        if (!response.ok) {
            console.error('LanguageTool API error:', response.status, await response.text());
            throw new Error(`LanguageTool API call failed with status ${response.status}`);
        }
        const data = await response.json();
        console.log('LanguageTool response:', { matches: data.matches.length, firstMatch: data.matches[0] });
        const score = Math.max(0, 100 - data.matches.length * 5);
        return { score, issues: data.matches };
    } catch (error) {
        console.error('LanguageTool error:', error.message);
        return { score: 80, issues: [] };
    }
};

// Function to transcribe audio from a VIDEO URL using AssemblyAI (No changes)
const transcribeAudio = async (videoUrl) => {
    if (!assemblyAIClient) {
        console.error('AssemblyAI client not initialized. Cannot transcribe.');
        return '[Transcription Failed: AssemblyAI client not ready]';
    }

    console.log(`DEBUG: Attempting AssemblyAI transcription for URL: ${videoUrl}`);
    console.log(`DEBUG: AssemblyAI API Key status: ${process.env.ASSEMBLYAI_API_KEY ? 'Present' : 'NOT Present'}`);

    try {
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio_url: videoUrl,
            punctuate: true,
            format_text: true,
        });

        if (transcript.status === 'completed') {
            console.log('AssemblyAI Transcription completed:', transcript.text.substring(0, Math.min(transcript.text.length, 200)) + '...');
            return transcript.text;
        } else {
            console.error('AssemblyAI Transcription failed or is not completed. Status:', transcript.status, 'Transcript Object:', transcript);
            return `[Transcription Failed: AssemblyAI status ${transcript.status}. Error: ${transcript.error || 'Unknown'}]`;
        }

    } catch (error) {
        console.error('CRITICAL ERROR during AssemblyAI audio transcription:', error);
        console.error('Full AssemblyAI error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return `[Transcription Failed: ${error.message}]`;
    }
};

// Function to analyze speech properties using Gemini API (No changes)
const analyzeSpeechWithGemini = async (transcription) => {
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set. Cannot perform LLM analysis.');
        return {
            overallScore: 0,
            fillerWords: [],
            speakingRate: 0,
            fluencyFeedback: 'LLM not configured.',
            sentiment: 'Neutral',
            areasForImprovement: []
        };
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `Analyze the following English speech transcription. Provide the following information in a concise, parseable JSON format.
    Do NOT include any preamble or extra text outside the JSON.

    JSON Schema:
    {
      "overallScore": number,
      "fillerWords": string[],
      "speakingRate": number,
      "fluencyFeedback": string,
      "sentiment": "Positive" | "Negative" | "Neutral",
      "areasForImprovement": string[]
    }

    Speech Transcription: "${transcription}"`;

    try {
        console.log('Sending transcription to Gemini for detailed analysis...');
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 800,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "overallScore": { "type": "NUMBER" },
                            "fillerWords": { "type": "ARRAY", "items": { "type": "STRING" } },
                            "speakingRate": { "type": "NUMBER" },
                            "fluencyFeedback": { "type": "STRING" },
                            "sentiment": { "type": "STRING" },
                            "areasForImprovement": { "type": "ARRAY", "items": { "type": "STRING" } }
                        },
                        "propertyOrdering": ["overallScore", "fillerWords", "speakingRate", "fluencyFeedback", "sentiment", "areasForImprovement"]
                    }
                },
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API analysis error response:', errorData);
            throw new Error(`Gemini API analysis failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log('Received Gemini analysis raw result:', result);

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonText = result.candidates[0].content.parts[0].text;
            console.log('Gemini analysis JSON string (first 200 chars):', jsonText.substring(0, Math.min(jsonText.length, 200)) + '...');
            try {
                const parsedAnalysis = JSON.parse(jsonText);
                return parsedAnalysis;
            } catch (jsonParseError) {
                console.error('Error parsing Gemini JSON response:', jsonParseError, 'Raw text:', jsonText);
                throw new Error('Failed to parse analysis from LLM response.');
            }
        } else {
            console.warn('Gemini API analysis response structure unexpected or empty:', result);
            throw new Error('No valid analysis content from LLM.');
        }

    } catch (error) {
        console.error('Error during Gemini analysis:', error);
        throw new Error('Failed to analyze speech with LLM: ' + error.message);
    }
};
// ... (keep your existing helper functions: analyzeGrammar, transcribeAudio, analyzeSpeechWithGemini)

const uploadVideo = asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) {
        res.status(400);
        throw new Error('No video file buffer received');
    }

    const { originalname, buffer, mimetype } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    if (!videoName) {
        res.status(400);
        throw new Error('Video name is required');
    }

    // Generate unique public_id
    const publicId = `comm-analyzer/videos/video-${userId}-${Date.now()}`;

    try {
        // Create video record in DB with 'uploading' status
        const newVideoRecord = await Video.create({
            userId,
            filename: originalname,
            videoName,
            publicId, // Store Cloudinary public_id
            status: 'uploading',
            uploadDate: new Date()
        });

        // Upload to Cloudinary with webhook notification
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: publicId,
                    notification_url: `${process.env.BACKEND_URL}/api/webhooks/cloudinary`,
                    eager: [
                        { format: 'mp4', quality: 'auto' }
                    ],
                    eager_async: true,
                    eager_notification_url: `${process.env.BACKEND_URL}/api/webhooks/cloudinary`,
                    chunk_size: 6000000
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        console.log('Cloudinary upload initiated:', {
            public_id: uploadResult.public_id,
            status: uploadResult.status
        });

        // Respond immediately - don't wait for processing
        res.status(202).json({
            message: 'Video upload started. Processing may take a few minutes.',
            videoId: newVideoRecord._id,
            status: 'uploading'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Failed to start upload process',
            details: error.message 
        });
    }
});

// Add webhook handler
const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
    try {
        // Verify webhook signature (important for security)
        const signature = req.headers['x-cld-signature'];
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHash('sha1')
            .update(payload + process.env.CLOUDINARY_API_SECRET)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.warn('Invalid webhook signature');
            return res.status(401).send('Unauthorized');
        }

        const event = req.body;
        console.log('Received Cloudinary webhook:', event);

        // Handle different notification types
        if (event.notification_type === 'eager') {
            const publicId = event.public_id;
            const secureUrl = event.eager[0]?.secure_url;

            if (!secureUrl) {
                console.error('No secure_url in eager notification');
                return res.status(400).send('Missing secure_url');
            }

            // Update video record with URL
            const video = await Video.findOneAndUpdate(
                { publicId },
                { 
                    status: 'ready',
                    videoUrl: secureUrl 
                },
                { new: true }
            );

            if (!video) {
                console.error('Video not found for publicId:', publicId);
                return res.status(404).send('Video not found');
            }

            console.log(`Video ${publicId} is now ready at URL: ${secureUrl}`);

            // Start analysis pipeline
            try {
                const transcription = await transcribeAudio(secureUrl);
                const grammarAnalysis = await analyzeGrammar(transcription);
                const geminiAnalysis = await analyzeSpeechWithGemini(transcription);

                const newAnalysis = await Analysis.create({
                    userId: video.userId,
                    videoRecordId: video._id,
                    videoUrl: secureUrl,
                    transcription,
                    overallScore: geminiAnalysis.overallScore,
                    grammarErrors: grammarAnalysis.issues,
                    fillerWords: geminiAnalysis.fillerWords,
                    speakingRate: geminiAnalysis.speakingRate,
                    fluencyFeedback: geminiAnalysis.fluencyFeedback,
                    sentiment: geminiAnalysis.sentiment,
                    areasForImprovement: geminiAnalysis.areasForImprovement
                });

                await Video.findByIdAndUpdate(video._id, {
                    status: 'analyzed',
                    analysisId: newAnalysis._id
                });

                console.log(`Analysis complete for video ${publicId}`);
            } catch (analysisError) {
                console.error('Analysis failed:', analysisError);
                await Video.findByIdAndUpdate(video._id, {
                    status: 'failed',
                    errorMessage: analysisError.message
                });
            }
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal server error');
    }
});

// Add status check endpoint
const checkVideoStatus = asyncHandler(async (req, res) => {
    const video = await Video.findById(req.params.videoId);
    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }
    res.json({
        status: video.status,
        videoUrl: video.videoUrl,
        analysisId: video.analysisId,
        error: video.errorMessage
    });
});

module.exports = {
    uploadVideo,
    handleCloudinaryWebhook,
    checkVideoStatus,
    getUserVideos
};
