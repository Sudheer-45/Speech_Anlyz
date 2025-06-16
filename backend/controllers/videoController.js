// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
// Removed fs and path imports as local file operations are no longer needed for videos

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

// Function to transcribe audio from a VIDEO URL using AssemblyAI
const transcribeAudio = async (videoUrl) => { // Now accepts a URL
    if (!assemblyAIClient) {
        console.error('AssemblyAI client not initialized. Cannot transcribe.');
        return '[Transcription Failed: AssemblyAI client not ready]';
    }

    try {
        console.log(`Sending video URL for transcription via AssemblyAI: ${videoUrl}`);
        
        // --- CRITICAL FIX: Use audio_url for remote URLs ---
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio_url: videoUrl, // <--- CHANGED: Use audio_url for remote URLs
            punctuation: true,
            formatText: true,
            // Add more features like speaker_diarization if needed for your analysis
            // speaker_diarization: true,
            // sentiment_analysis: true,
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

// Function to analyze speech properties using Gemini API (unchanged)
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
    // Multer (configured with CloudinaryStorage in routes/video.js)
    // will have uploaded the video to Cloudinary.
    // req.file.path contains the secure URL from Cloudinary.

    if (!req.file) {
        res.status(400);
        throw new Error('No video file uploaded.');
    }

    const { videoName } = req.body;
    // Extract the Cloudinary URL from req.file.path (renamed for clarity)
    const { originalname, path: videoCloudinaryUrl } = req.file; 
    const userId = req.user._id;

    // Use the Cloudinary URL as the persistent video URL
    const videoUrl = videoCloudinaryUrl; 

    let newVideoRecord;
    try {
        newVideoRecord = await Video.create({
            userId,
            filename: originalname,
            videoUrl: videoUrl, // Store the Cloudinary URL for playback
            filePath: videoUrl, // Store the Cloudinary URL here too for consistency with previous schema (if desired)
            status: 'uploaded',
        });
    } catch (dbError) {
        console.error('Error saving raw video record to DB:', dbError);
        // No local file to clean up here, as it's uploaded directly to Cloudinary
        res.status(500);
        throw new Error('Server error: Could not record video upload.');
    }

    // Send a 202 Accepted response immediately, so frontend doesn't hang
    res.status(202).json({
        message: 'Video uploaded successfully. Analysis in progress.',
        videoRecordId: newVideoRecord ? newVideoRecord._id : null,
        videoUrl: videoUrl, // Optionally send the Cloudinary URL back to frontend for immediate use
    });

    // --- ASYNCHRONOUS ANALYSIS START ---
    // This part runs in the background after sending the initial response
    try {
        console.log(`Starting real analysis for video: ${originalname} from URL: ${videoUrl}`);

        // 1. Transcribe audio from the uploaded VIDEO URL using AssemblyAI
        const transcription = await transcribeAudio(videoUrl); // Pass the Cloudinary URL directly
        if (transcription.startsWith('[Transcription Failed')) {
            throw new Error(transcription); 
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
            videoUrl: videoUrl, // This is now the persistent Cloudinary URL
            videoPath: videoUrl, // Consistent with videoUrl for persistence
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
            newVideoRecord.analysisId = newAnalysis._id; // Store reference to Analysis
            await newVideoRecord.save();
        }

        console.log(`Analysis complete and saved for video: ${videoName || originalname}. Analysis ID: ${newAnalysis._id}`);

        // No local file cleanup needed here as videos are directly uploaded to Cloudinary
    } catch (analysisError) {
        console.error(`Error analyzing or saving analysis for video ${originalname}:`, analysisError);
        // Update video status to failed if analysis fails
        if (newVideoRecord) {
            newVideoRecord.status = 'failed';
            newVideoRecord.errorMessage = analysisError.message; 
            await newVideoRecord.save();
        }
        // No local file cleanup needed here
    }
});

// @desc    Get all videos for a logged-in user
// @route   GET /api/user/videos
// @access  Private
const getUserVideos = asyncHandler(async (req, res) => {
    // This route remains the same as it fetches from the database.
    // The videoUrl in the returned objects will now be the persistent Cloudinary URL.
    const videos = await Video.find({ userId: req.user._id }).sort({ uploadDate: -1 });
    res.status(200).json({ videos });
});

module.exports = {
    uploadVideo,
    getUserVideos,
};
