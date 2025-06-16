// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');

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

// LanguageTool grammar analysis (Your existing function, unchanged)
const analyzeGrammar = async (text) => {
    try {
        console.log('Sending text to LanguageTool API...');
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        if (!response.ok) {
            console.error('LanguageTool API error:', response.status);
            throw new Error(`LanguageTool API call failed with status ${response.status}`);
        }
        const data = await response.json();
        console.log('LanguageTool response:', { matches: data.matches });
        const score = Math.max(0, 100 - data.matches.length * 5); 
        return { score, issues: data.matches };
    } catch (error) {
        console.error('LanguageTool error:', error.message);
        return { score: 80, issues: [] }; 
    }
};

// Function to transcribe audio from a file path using AssemblyAI
const transcribeAudio = async (filePath) => {
    if (!assemblyAIClient) {
        console.error('AssemblyAI client not initialized. Cannot transcribe.');
        return '[Transcription Failed: AssemblyAI client not ready]';
    }

    try {
        console.log(`Sending audio for transcription via AssemblyAI: ${filePath}`);
        // AssemblyAI SDK can directly read the local file path
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio: filePath, 
            punctuation: true,
            formatText: true,
            // You can add more features here based on AssemblyAI capabilities if needed
            // e.g., speaker_diarization: true, sentiment_analysis: true
        });

        if (transcript.status === 'completed') {
            console.log('AssemblyAI Transcription completed:', transcript.text);
            return transcript.text;
        } else {
            console.error('AssemblyAI Transcription failed or is not completed. Status:', transcript.status);
            // If transcription fails, return a meaningful error message
            return `[Transcription Failed: AssemblyAI status ${transcript.status}. Error: ${transcript.error || 'Unknown'}]`;
        }

    } catch (error) {
        console.error('Error during AssemblyAI audio transcription:', error);
        return `[Transcription Failed: ${error.message}]`;
    }
};

// Function to analyze speech properties using Gemini API
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
      "overallScore": number, // On a scale of 0-100, reflecting overall communication effectiveness. Higher is better.
      "fillerWords": string[], // List common filler words detected (e.g., "um", "uh", "like", "you know").
      "speakingRate": number, // Estimated words per minute.
      "fluencyFeedback": string, // Concise feedback on flow and smoothness.
      "sentiment": "Positive" | "Negative" | "Neutral", // Overall sentiment expressed.
      "areasForImprovement": string[] // 2-3 specific areas for improvement (e.g., "reduce pauses", "vary pitch").
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
            console.log('Gemini analysis JSON string:', jsonText);
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
// @route   POST /api/upload (Note: This is your general video upload route)
// @access  Private
const uploadVideo = asyncHandler(async (req, res) => {
    // This controller assumes Multer has already saved the video file locally
    // to a temporary location, and req.file.path points to that local file.
    // IMPORTANT: Local video files are ephemeral on Render. They will be deleted on redeploy/restart.
    // For persistent video storage, you'd need to integrate Cloudinary or AWS S3 for videos too.

    if (!req.file) {
        res.status(400);
        throw new Error('No video file uploaded.');
    }

    const { videoName } = req.body;
    const { originalname, filename, path: filePath } = req.file; // filePath is local path
    const userId = req.user._id;

    // The videoUrl for playback will be broken if the local file is deleted.
    // For full functionality, video playback needs persistent storage like Cloudinary for videos.
    const videoUrl = `/uploads/${filename}`; // Assuming your server serves /uploads statically


    let newVideoRecord;
    try {
        newVideoRecord = await Video.create({
            userId,
            filename: originalname,
            filePath: filePath.replace(/\\/g, '/'), // This path is local, not persistent
            status: 'uploaded',
        });
    } catch (dbError) {
        console.error('Error saving raw video record to DB:', dbError);
        // Clean up locally stored file on DB error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); 
        }
        res.status(500);
        throw new Error('Server error: Could not record video upload.');
    }

    // Send a 202 Accepted response immediately, so frontend doesn't hang
    res.status(202).json({
        message: 'Video uploaded successfully. Analysis in progress.',
        videoRecordId: newVideoRecord ? newVideoRecord._id : null,
    });

    // --- ASYNCHRONOUS ANALYSIS START ---
    // This part runs in the background after sending the initial response
    try {
        console.log(`Starting real analysis for video: ${filename}`);

        // 1. Transcribe audio from the uploaded video file using AssemblyAI
        const transcription = await transcribeAudio(filePath);
        // Check if transcription failed and handle it
        if (transcription.startsWith('[Transcription Failed')) {
            throw new Error(transcription); // Re-throw to catch block
        }
        console.log('Completed transcription:', transcription.substring(0, Math.min(transcription.length, 100)) + '...'); 

        // 2. Perform grammar analysis using LanguageTool
        const grammarAnalysis = await analyzeGrammar(transcription);
        console.log('Completed grammar analysis:', grammarAnalysis);

        // 3. Perform detailed speech analysis using Gemini
        const geminiAnalysis = await analyzeSpeechWithGemini(transcription);
        console.log('Completed Gemini analysis:', geminiAnalysis);

        // Combine all analysis results and save to Analysis model
        const newAnalysis = await Analysis.create({
            userId: userId,
            // IMPORTANT: If you move video files to Cloudinary, update videoUrl here
            videoUrl: videoUrl, // This URL will be broken after server restart if video is not persistently stored
            videoPath: filePath.replace(/\\/g, '/'), 
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

        // Update the Video record with analysis status and ID
        if (newVideoRecord) {
            newVideoRecord.status = 'analyzed';
            newVideoRecord.analysisId = newAnalysis._id;
            await newVideoRecord.save();
        }

        console.log(`Analysis complete and saved for video: ${videoName || originalname}. Analysis ID: ${newAnalysis._id}`);

        // Clean up the local video file after analysis (CRITICAL for Render's ephemeral storage)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up local video file: ${filePath}`);
        }

    } catch (analysisError) {
        console.error(`Error analyzing or saving analysis for video ${originalname}:`, analysisError);
        // Update video status to failed if analysis fails
        if (newVideoRecord) {
            newVideoRecord.status = 'failed';
            // Also store the error message for debugging/display in the UI
            newVideoRecord.errorMessage = analysisError.message; 
            await newVideoRecord.save();
        }
        // Clean up local file even on analysis error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up local video file after analysis error: ${filePath}`);
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
