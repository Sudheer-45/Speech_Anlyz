// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2; // Import cloudinary here

// Cloudinary configuration (ensure env vars are set in Render)
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


// @desc    Upload a video for analysis
// @route   POST /api/upload
// @access  Private
const uploadVideo = asyncHandler(async (req, res) => {
    console.log('DEBUG: Received upload request in uploadVideo controller.');
    console.log('DEBUG: Received req.file object from Multer:', req.file); // Now contains buffer or path
    console.log('DEBUG: Received req.body:', req.body);

    if (!req.file || !req.file.buffer) { // Check for buffer if using memoryStorage
        res.status(400);
        throw new Error('No video file buffer received. Multer did not process the upload correctly.');
    }

    const { originalname, buffer, mimetype } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    if (!videoName) {
        res.status(400);
        throw new Error('Video name is required.'); // Corrected: Removed extra 'new' keyword
    }

    // --- Direct Cloudinary Upload ---
    let videoCloudinaryUrl;
    let videoCloudinaryPublicId;

    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary credentials not set. Cannot upload to Cloudinary.');
            res.status(500);
            throw new Error('Server Error: Cloudinary is not configured correctly. Missing API credentials.');
        }

        console.log('Attempting direct upload to Cloudinary...');
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'comm-analyzer/videos',
                    resource_type: 'video',
                    public_id: `video-${userId}-${Date.now()}`,
                    chunk_size: 6000000, // 6MB chunks for robust upload
                    async: true, // Process asynchronously
                    // --- Re-introducing eager transformations with MP4 format ---
                    eager: [
                        { format: 'mp4', quality: 'auto', crop: 'limit', width: 1280, height: 720 },
                        // You can add other resolutions/formats here if needed, e.g., for mobile playback
                        // { format: 'mp4', quality: 'auto', crop: 'limit', width: 640, height: 360 }
                    ],
                    eager_async: true, // Perform eager transformations asynchronously
                    format: 'mp4' // Explicitly set output format to MP4
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload stream callback error:', error);
                        return reject(new Error(`Cloudinary upload failed (callback): ${error.message}`));
                    }
                    console.log('Cloudinary upload stream callback result:', { secure_url: result.secure_url, public_id: result.public_id, bytes: result.bytes, eager_results: result.eager ? result.eager.length : 0 });
                    resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        console.log('DEBUG: Full Cloudinary uploadResult object from promise resolution:', JSON.stringify(uploadResult, null, 2));

        if (uploadResult && uploadResult.secure_url) {
            videoCloudinaryUrl = uploadResult.secure_url;
        } else {
            console.error('ERROR: Cloudinary upload result did NOT contain a secure_url, despite callback. Full result:', uploadResult);
            throw new Error('Cloudinary upload completed, but no secure video URL was returned.');
        }

        if (uploadResult && uploadResult.public_id) {
            videoCloudinaryPublicId = uploadResult.public_id;
        } else {
            console.error('ERROR: Cloudinary upload result did NOT contain a public_id. Full result:', uploadResult);
            throw new Error('Cloudinary upload completed, but no public ID was returned.');
        }

        console.log(`Cloudinary upload successful. URL: ${videoCloudinaryUrl}, Public ID: ${videoCloudinaryPublicId}`);

    } catch (cloudinaryError) {
        console.error('ERROR: Catch block for direct Cloudinary upload triggered:', cloudinaryError);
        res.status(500);
        throw new Error('Server error: Failed to upload video to Cloudinary: ' + cloudinaryError.message);
    }

    let newVideoRecord;
    try {
        newVideoRecord = await Video.create({
            userId,
            filename: originalname, // Original filename from client
            videoName: videoName || originalname,
            videoUrl: videoCloudinaryUrl, // This will now be set (or error thrown above)
            filePath: videoCloudinaryPublicId, // Store the Cloudinary public_id
            status: 'uploaded', // Initial status
            uploadDate: new Date(),
        });
        console.log('Video record created in DB:', newVideoRecord);
    } catch (dbError) {
        console.error('Error saving raw video record to DB:', dbError);
        if (dbError.name === 'ValidationError') {
            const messages = Object.values(dbError.errors).map(val => val.message);
            res.status(400);
            throw new Error(`Video validation failed: ${messages.join(', ')}`);
        } else {
            res.status(500);
            throw new Error('Server error: Could not record video upload due to DB error: ' + dbError.message);
        }
    }

    // Send a 202 Accepted response immediately as analysis is asynchronous
    res.status(202).json({
        message: 'Video uploaded successfully. Analysis in progress.',
        videoRecordId: newVideoRecord ? newVideoRecord._id : null,
        videoUrl: videoCloudinaryUrl,
        videoName: videoName || originalname
    });

    // --- ASYNCHRONOUS ANALYSIS START ---
    // This part runs after the response has been sent to the client.
    try {
        console.log(`Starting real analysis for video: ${videoName || originalname} from URL: ${videoCloudinaryUrl}`);

        const transcription = await transcribeAudio(videoCloudinaryUrl);
        if (transcription.startsWith('[Transcription Failed')) {
            throw new Error(transcription);
        }
        console.log('Completed transcription:', transcription.substring(0, Math.min(transcription.length, 100)) + '...');

        const grammarAnalysis = await analyzeGrammar(transcription);
        console.log('Completed grammar analysis:', grammarAnalysis);

        const geminiAnalysis = await analyzeSpeechWithGemini(transcription);
        console.log('Completed Gemini analysis:', geminiAnalysis);

        const newAnalysis = await Analysis.create({
            userId: userId,
            videoRecordId: newVideoRecord._id, // Link analysis to the video record
            videoUrl: videoCloudinaryUrl,
            videoPath: videoCloudinaryPublicId, // Consistent naming for public_id
            videoName: videoName || originalname,
            date: new Date(),
            transcription: transcription,
            overallScore: geminiAnalysis.overallScore,
            grammarErrors: grammarAnalysis.issues.map(issue => ({
                message: issue.message,
                text: issue.context.text,
                offset: issue.context.offset,
                length: issue.context.length,
                replacements: issue.replacements.map(rep => rep.value)
            })),
            fillerWords: geminiAnalysis.fillerWords,
            speakingRate: geminiAnalysis.speakingRate,
            fluencyFeedback: geminiAnalysis.fluencyFeedback,
            sentiment: geminiAnalysis.sentiment,
            areasForImprovement: geminiAnalysis.areasForImprovement,
        });

        // Update the video record with analysis details and status
        if (newVideoRecord) {
            newVideoRecord.status = 'analyzed';
            newVideoRecord.analysisId = newAnalysis._id;
            await newVideoRecord.save();
        }

        console.log(`Analysis complete and saved for video: ${videoName || originalname}. Analysis ID: ${newAnalysis._id}`);

    } catch (analysisError) {
        console.error(`Error analyzing or saving analysis for video ${originalname}:`, analysisError);
        if (newVideoRecord) {
            newVideoRecord.status = 'failed';
            newVideoRecord.errorMessage = analysisError.message;
            await newVideoRecord.save();
        }
    }
});

// @desc    Get all videos for a logged-in user
// @route   GET /api/user/videos
// @access  Private
const getUserVideos = asyncHandler(async (req, res) => {
    const videos = await Video.find({ userId: req.user._id }).sort({ uploadDate: -1 });
    res.status(200).json({ videos });
});

module.exports = {
    uploadVideo,
    getUserVideos,
};
