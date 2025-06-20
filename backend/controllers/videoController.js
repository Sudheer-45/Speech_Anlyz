// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');

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

// LanguageTool grammar analysis
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
        // Example scoring: 100 minus 5 points per error, min 0
        const score = Math.max(0, 100 - data.matches.length * 5);
        return { score, issues: data.matches };
    } catch (error) {
        console.error('LanguageTool error:', error.message);
        // Provide a default/fallback score and empty issues if API fails
        return { score: 80, issues: [] };
    }
};

// Function to transcribe audio from a VIDEO URL using AssemblyAI
const transcribeAudio = async (videoUrl) => { // Now accepts a URL
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
            // Include transcript.error if available for more specific debugging
            return `[Transcription Failed: AssemblyAI status ${transcript.status}. Error: ${transcript.error || 'Unknown'}]`;
        }

    } catch (error) {
        console.error('CRITICAL ERROR during AssemblyAI audio transcription:', error);
        // Log the full error object if possible for detailed debugging
        console.error('Full AssemblyAI error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
    // --- CRITICAL DEBUGGING LINE ---
    console.log('DEBUG: Received req.file object in uploadVideo controller:', req.file);
    console.log('DEBUG: Received req.body in uploadVideo controller:', req.body);

    if (!req.file) {
        res.status(400);
        throw new Error('No video file uploaded. Multer did not provide req.file.');
    }

    // Explicitly check for req.file.path (the Cloudinary URL) and req.file.filename (the public_id)
    if (!req.file.path || !req.file.filename) {
        console.error('ERROR: req.file.path or req.file.filename is undefined after Multer/Cloudinary processing. Full req.file:', req.file);
        res.status(500);
        throw new Error('Server error: Video URL or public ID not generated by Cloudinary upload. Check Cloudinary settings or file filters.');
    }

    const { originalname, path: videoCloudinaryUrl, filename: videoCloudinaryPublicId } = req.file;
    const { videoName } = req.body;
    const userId = req.user._id;

    let newVideoRecord;
    try {
        newVideoRecord = await Video.create({
            userId,
            filename: originalname,
            videoName: videoName || originalname, // Use provided videoName or original filename
            videoUrl: videoCloudinaryUrl,
            filePath: videoCloudinaryPublicId, // Store the Cloudinary public_id
            status: 'uploaded', // Initial status
            uploadDate: new Date(), // Add uploadDate field
        });
        console.log('Video record created in DB:', newVideoRecord);
    } catch (dbError) {
        console.error('Error saving raw video record to DB:', dbError);
        throw new Error('Server error: Could not record video upload due to DB validation: ' + dbError.message);
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
            // Combine grammar analysis issues with any other grammar-related insights from Gemini if applicable
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
        // Update video record status to failed if analysis pipeline fails
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
