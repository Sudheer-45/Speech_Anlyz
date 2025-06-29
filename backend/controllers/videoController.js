// backend/controllers/videoController.js
const Video = require('../models/Video'); // Your Video Model
const Analysis = require('../models/Analysis'); // Your Analysis Model
const asyncHandler = require('express-async-handler'); // For simplifying async error handling
const cloudinary = require('cloudinary').v2; // Cloudinary SDK
const crypto = require('crypto'); // Built-in Node.js crypto (less relevant for Cloudinary signature itself now)

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

// Gemini API key (for LLM analysis)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Analyzes grammar using the LanguageTool API.
 * @param {string} text - The transcription text to analyze.
 * @returns {Promise<{score: number, issues: Array<Object>}>} Grammar score and issues.
 */
const analyzeGrammar = asyncHandler(async (text) => {
    try {
        console.log('[LanguageTool] Sending text to LanguageTool API...');
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LanguageTool] API error:', response.status, errorText);
            throw new Error(`LanguageTool API call failed with status ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        console.log('[LanguageTool] response:', { matches: data.matches.length, firstMatch: data.matches[0] ? data.matches[0].message : 'N/A' });
        // Simplified scoring for demonstration
        const score = Math.max(0, 100 - data.matches.length * 5);
        return { score, issues: data.matches };
    } catch (error) {
        console.error('[LanguageTool] error:', error.message);
        // Fallback score and no issues if LanguageTool fails
        return { score: 80, issues: [] };
    }
});

/**
 * Transcribes audio from a video URL using AssemblyAI.
 * @param {string} videoUrl - The URL of the video to transcribe.
 * @returns {Promise<string>} The transcribed text or an error message.
 */
const transcribeAudio = asyncHandler(async (videoUrl) => {
    if (!assemblyAIClient) {
        console.error('[AssemblyAI] client not initialized. Cannot transcribe.');
        return '[Transcription Failed: AssemblyAI client not ready]';
    }

    console.log(`[AssemblyAI] Attempting transcription for URL: ${videoUrl}`);
    console.log(`[AssemblyAI] API Key status: ${process.env.ASSEMBLYAI_API_KEY ? 'Present' : 'NOT Present'}`);

    try {
        const transcript = await assemblyAIClient.transcripts.transcribe({
            audio_url: videoUrl,
            punctuate: true,
            format_text: true,
        });

        if (transcript.status === 'completed') {
            console.log('[AssemblyAI] Transcription completed (first 200 chars):', transcript.text.substring(0, Math.min(transcript.text.length, 200)) + '...');
            return transcript.text;
        } else {
            console.error(`[AssemblyAI] Transcription failed or is not completed. Status: ${transcript.status}. Error: ${transcript.error || 'Unknown'}`);
            return `[Transcription Failed: AssemblyAI status ${transcript.status}. Error: ${transcript.error || 'Unknown'}]`;
        }

    } catch (error) {
        console.error('[AssemblyAI] CRITICAL ERROR during audio transcription:', error);
        console.error('[AssemblyAI] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return `[Transcription Failed: ${error.message}]`;
    }
});

/**
 * Analyzes speech properties (filler words, rate, sentiment, etc.) using Gemini API.
 * @param {string} transcription - The transcribed text of the speech.
 * @returns {Promise<Object>} The analysis results from Gemini.
 */
const analyzeSpeechWithGemini = asyncHandler(async (transcription) => {
    if (!GEMINI_API_KEY) {
        console.error('[Gemini] GEMINI_API_KEY is not set. Cannot perform LLM analysis.');
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
        console.log('[Gemini] Sending transcription to Gemini for detailed analysis...');
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
            console.error('[Gemini] API analysis error response:', errorData);
            throw new Error(`Gemini API analysis failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log('[Gemini] Received analysis raw result:', result);

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonText = result.candidates[0].content.parts[0].text;
            console.log('[Gemini] Analysis JSON string (first 200 chars):', jsonText.substring(0, Math.min(jsonText.length, 200)) + '...');
            try {
                const parsedAnalysis = JSON.parse(jsonText);
                return parsedAnalysis;
            } catch (jsonParseError) {
                console.error('[Gemini] Error parsing JSON response:', jsonParseError, 'Raw text:', jsonText);
                throw new Error('Failed to parse analysis from LLM response.');
            }
        } else {
            console.warn('[Gemini] API analysis response structure unexpected or empty:', result);
            // FIX: Corrected typo - removed extra 'new'
            throw new Error('No valid analysis content from LLM.'); 
        }

    } catch (error) {
        console.error('[Gemini] Error during analysis:', error);
        throw new Error('Failed to analyze speech with LLM: ' + error.message);
    }
});

/**
 * Runs the full analysis pipeline: transcription, grammar, Gemini analysis, and saves results.
 * @param {string} videoRecordId - MongoDB _id of the video record.
 * @param {string} videoUrl - The Cloudinary secure URL of the video.
 * @param {string} userId - MongoDB _id of the user.
 * @param {string} originalname - Original filename of the video.
 * @param {string} videoName - User-provided name for the video.
 * @param {string} videoCloudinaryPublicId - Cloudinary public ID of the video.
 */
const runAnalysisPipeline = asyncHandler(async (videoRecordId, videoUrl, userId, originalname, videoName, videoCloudinaryPublicId) => {
    let videoRecord = null;
    try {
        videoRecord = await Video.findById(videoRecordId);
        if (!videoRecord) {
            console.error(`[AnalysisPipeline] Aborted: Video record with ID ${videoRecordId} not found.`);
            return;
        }

        console.log(`[AnalysisPipeline] Starting full analysis pipeline for video: ${videoName || originalname} (ID: ${videoRecordId}) from URL: ${videoUrl}`);

        // Update status and set analysisStartedAt
        videoRecord.status = 'analyzing'; // Matches enum: 'analyzing'
        videoRecord.analysisStartedAt = new Date(); // Update timestamp
        await videoRecord.save();
        console.log(`[AnalysisPipeline] Video ID ${videoRecordId} status updated to 'analyzing'.`);

        const transcription = await transcribeAudio(videoUrl);
        if (transcription.startsWith('[Transcription Failed')) {
            throw new Error(transcription);
        }
        console.log('[AnalysisPipeline] Completed transcription.');

        const grammarAnalysis = await analyzeGrammar(transcription);
        console.log('[AnalysisPipeline] Completed grammar analysis.');

        const geminiAnalysis = await analyzeSpeechWithGemini(transcription);
        console.log('[AnalysisPipeline] Completed Gemini analysis.');

        // FIX: Ensure userId is correctly passed to Analysis.create
        const newAnalysis = await Analysis.create({
            userId: userId, // Keep userId for Analysis model as per its schema
            videoRecordId: videoRecordId,
            videoUrl: videoUrl,
            videoPath: videoCloudinaryPublicId, 
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

        // Update the video record with analysis details and final status
        videoRecord.status = 'analyzed'; // Matches enum: 'analyzed'
        // FIX: Ensure 'analysis' field is used as per VideoSchema (if VideoSchema uses 'analysis' for Analysis ID)
        videoRecord.analysis = newAnalysis._id; 
        videoRecord.analysisCompletedAt = new Date(); // Update timestamp
        await videoRecord.save();
        console.log(`[AnalysisPipeline] Analysis complete and saved for video: ${videoName || originalname}. Analysis ID: ${newAnalysis._id}. Video status updated to 'analyzed'.`);

    } catch (analysisError) {
        console.error(`[AnalysisPipeline] CRITICAL ERROR in analysis pipeline for video ${videoRecordId}:`, analysisError);
        // Update video record status to failed if analysis pipeline fails
        if (videoRecord) {
            videoRecord.status = 'failed'; // Matches enum: 'failed'
            videoRecord.errorMessage = analysisError.message;
            // Optionally update analysisCompletedAt if it's a "failure completion"
            videoRecord.analysisCompletedAt = new Date();
            await videoRecord.save();
            console.log(`[AnalysisPipeline] Video ID ${videoRecordId} status updated to 'failed'. Error: ${analysisError.message}`);
        } else {
            console.error(`[AnalysisPipeline] Could not update video record status for ${videoRecordId} as it was not found.`);
        }
    }
});

/**
 * Handles video upload, initiates Cloudinary upload, and creates a video record.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const uploadVideo = asyncHandler(async (req, res) => {
    console.log('--- [UploadController] Received upload request ---');
    console.log('DEBUG: [UploadController] Received req.file object from Multer:', {
        originalname: req.file ? req.file.originalname : 'N/A',
        mimetype: req.file ? req.file.mimetype : 'N/A',
        size: req.file ? req.file.size : 'N/A',
        bufferExists: !!(req.file && req.file.buffer)
    });
    console.log('DEBUG: [UploadController] Received req.body:', req.body);

    if (!req.file || !req.file.buffer) {
        res.status(400);
        throw new Error('No video file buffer received. Multer did not process the upload correctly.');
    }

    const { originalname, buffer, mimetype, size } = req.file; // Destructure mimetype and size
    const { videoName } = req.body;
    const userId = req.user._id;

    if (!videoName || videoName.trim() === '') {
        res.status(400);
        throw new Error('Video name is required.');
    }

    let videoCloudinaryPublicId;

    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('[UploadController] Cloudinary credentials not set. Cannot upload to Cloudinary.');
            res.status(500);
            throw new Error('Server Error: Cloudinary is not configured correctly. Missing API credentials.');
        }
        if (!process.env.RENDER_BACKEND_URL) {
            console.error('[UploadController] RENDER_BACKEND_URL environment variable is not set. Cloudinary webhook will not work.');
            res.status(500);
            throw new Error('Server Error: RENDER_BACKEND_URL environment variable is not set.');
        }

        // FIX: Ensure notificationUrl matches where webhookRoutes is mounted in server.js
        const notificationUrl = `${process.env.RENDER_BACKEND_URL}/api/webhook`; 
        console.log(`[UploadController] Using Cloudinary webhook URL: ${notificationUrl}`);
        console.log('[UploadController] Attempting direct upload to Cloudinary with webhook notification...');

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'comm-analyzer/videos',
                    resource_type: 'video',
                    public_id: `video-${userId}-${Date.now()}`,
                    chunk_size: 6000000,
                    async: true,
                    eager: [
                        { format: 'mp4', quality: 'auto:eco', crop: 'limit', width: 1280, height: 720 },
                    ],
                    eager_async: true,
                    format: 'mp4',
                    notification_url: notificationUrl
                },
                (error, result) => {
                    if (error) {
                        console.error('[UploadController] Cloudinary upload stream callback error during initial upload:', error);
                        if (result && result.public_id) {
                            console.warn('[UploadController] Cloudinary upload callback had an error but returned a public_id. Resolving with partial result.', result);
                            return resolve(result);
                        }
                        return reject(new Error(`Cloudinary initial upload failed: ${error.message}`));
                    }
                    console.log('[UploadController] Cloudinary upload stream callback result for initial upload:', { secure_url: result.secure_url, public_id: result.public_id, bytes: result.bytes, eager_results: result.eager ? result.eager.length : 0, status: result.status });
                    resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        if (!uploadResult || !uploadResult.public_id) {
            console.error('[UploadController] ERROR: Cloudinary initial upload did not return a public_id. Full result:', uploadResult);
            throw new Error('Cloudinary initial upload failed: No public ID returned for tracking.');
        }

        // FIX: Use 'publicId' as per VideoSchema and correct field names for Video.create
        videoCloudinaryPublicId = uploadResult.public_id; 
        const initialVideoCloudinaryUrl = uploadResult.secure_url; // This will likely be undefined

        let newVideoRecord;
        try {
            newVideoRecord = await Video.create({
                user: userId, // FIX: Schema field is 'user', not 'userId'
                filename: originalname,
                videoName: videoName || originalname,
                publicId: videoCloudinaryPublicId, // Use publicId from schema
                videoUrl: initialVideoCloudinaryUrl, // Will be undefined/null, which is allowed by schema
                // FIX: Use 'Cloudinary Uploading' as per VideoSchema enum
                status: 'Cloudinary Uploading', 
                uploadStartedAt: new Date(), // New field
                bytes: size, // New field
                mimetype: mimetype, // New field
            });
            console.log('[UploadController] Video record created in DB with status "Cloudinary Uploading":', newVideoRecord._id);
        } catch (dbError) {
            console.error('[UploadController] Error saving video record to DB (initial status):', dbError);
            if (dbError.name === 'ValidationError') {
                const messages = Object.values(dbError.errors).map(val => val.message);
                res.status(400);
                throw new Error(`Video validation failed: ${messages.join(', ')}`);
            } else {
                res.status(500);
                throw new Error('Server error: Could not record video upload due to DB error: ' + dbError.message);
            }
        }

        res.status(202).json({
            message: 'Video upload initiated. Analysis will begin once Cloudinary processing is complete.',
            videoRecordId: newVideoRecord._id,
            videoUrl: newVideoRecord.videoUrl || null, // Will be null initially
            videoName: newVideoRecord.videoName,
            publicId: newVideoRecord.publicId,
            status: newVideoRecord.status
        });

    } catch (cloudinaryError) {
        console.error('[UploadController] ERROR: Catch block for initial Cloudinary upload triggered:', cloudinaryError);
        if (!res.headersSent) {
            res.status(500);
        }
        throw new Error('Server error: Failed to initiate video upload to Cloudinary: ' + cloudinaryError.message);
    }
});

/**
 * Handles Cloudinary Webhook for video processing completion.
 * @param {Object} req - Express request object (with rawBody from middleware).
 * @param {Object} res - Express response object.
 */
const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
    console.log('--- [WebhookController] Received Cloudinary webhook notification ---');
    console.log('DEBUG: [WebhookController] Full webhook body:', JSON.stringify(req.body, null, 2));
    
    // Ensure rawBody is available (set by middleware in webhookRoutes.js)
    const rawBodyString = req.rawBody; // Assumed to be correctly set by webhookRoutes middleware
    const signature = req.headers['x-cld-signature'];
    const timestamp = req.headers['x-cld-timestamp']; // Use header timestamp for verification

    console.log('DEBUG: [WebhookController] Raw Body for signature (stringified):', rawBodyString ? rawBodyString.substring(0, 200) + '...' : 'N/A');
    console.log('DEBUG: [WebhookController] Timestamp for signature:', timestamp);


    if (!signature || !timestamp || !rawBodyString) {
        console.error('[WebhookController] Missing Cloudinary webhook headers or raw body for signature verification.');
        // Respond with 200 to prevent Cloudinary retrying endlessly for missing headers
        return res.status(200).send('Missing webhook headers or raw body.');
    }

    try {
        // FIX: Use cloudinary.utils.api_sign_request for proper verification
        const expectedSignature = cloudinary.utils.api_sign_request(rawBodyString, process.env.CLOUDINARY_API_SECRET, timestamp);
        if (expectedSignature !== signature) {
            console.error('[WebhookController] Webhook signature verification failed! Expected:', expectedSignature, 'Received:', signature);
            // Respond with 200 to prevent Cloudinary retrying endlessly on signature mismatch
            return res.status(200).send('Invalid webhook signature (logged as warning)');
        }
        console.log('[WebhookController] Webhook signature verified successfully.');
    } catch (sigErr) {
        console.error('[WebhookController] Error during webhook signature verification:', sigErr);
        // Respond with 200 for internal errors during verification
        return res.status(200).send('Webhook signature verification error (logged as warning)'); 
    }

    const { notification_type, public_id, url, secure_url, status, error, eager } = req.body; 

    if (notification_type === 'upload' || notification_type === 'eager_transformation_completed') {
        console.log(`[WebhookController] Processing notification type: '${notification_type}' for public_id: '${public_id}'. Status: '${status}'`);

        if (!public_id) {
            console.error('[WebhookController] Webhook payload missing public_id. Cannot process.');
            return res.status(400).send('Missing public_id in webhook payload.');
        }

        // FIX: Use 'publicId' as per VideoSchema
        let videoRecord = await Video.findOne({ publicId: public_id }); 
        if (!videoRecord) {
            console.error(`[WebhookController] No video record found in DB for public_id: ${public_id}. This could mean the record was deleted or webhook sent too fast.`);
            return res.status(404).send('Video record not found for this public ID.');
        }

        console.log(`[WebhookController] Found video record (ID: ${videoRecord._id}) for public_id: ${public_id}. Current status: ${videoRecord.status}`);

        // Update lastCheckedAt to show webhook was received and processed
        videoRecord.lastCheckedAt = new Date();

        if (status === 'completed') {
            const allEagerCompleted = eager ? eager.every(t => t.status === 'completed') : true;

            if (allEagerCompleted) {
                console.log(`[WebhookController] Cloudinary processing and eager transformations completed successfully for ${public_id}. Final secure_url: ${secure_url}`);

                if (!secure_url) {
                    console.error(`[WebhookController] Webhook status is 'completed' but secure_url is missing for ${public_id}. Cannot proceed with analysis.`);
                    videoRecord.status = 'failed'; 
                    videoRecord.errorMessage = `Cloudinary completed but no secure URL: ${JSON.stringify(req.body)}`;
                    await videoRecord.save();
                    return res.status(500).send('Cloudinary processing completed but URL missing.');
                }

                videoRecord.videoUrl = secure_url;
                videoRecord.status = 'processed'; // New status: 'processed' after Cloudinary finished
                videoRecord.processingCompletedAt = new Date();
                await videoRecord.save();
                console.log(`[WebhookController] Video record ID ${videoRecord._id} videoUrl updated and status set to 'processed'.`);

                // Trigger the main analysis pipeline now that Cloudinary processing is done
                runAnalysisPipeline(
                    videoRecord._id,
                    secure_url,
                    videoRecord.user, // FIX: Use videoRecord.user as per schema for Analysis.create
                    videoRecord.filename,
                    videoRecord.videoName,
                    public_id 
                ).catch(analysisErr => {
                    console.error(`[WebhookController] Uncaught error during async analysis pipeline for ${public_id}:`, analysisErr);
                });

                res.status(200).send('Webhook processed: Cloudinary processing complete, analysis initiated.');

            } else {
                console.log(`[WebhookController] Cloudinary upload completed, but eager transformations are still 'processing' or 'failed' for ${public_id}. Current status: ${videoRecord.status}`);
                videoRecord.status = 'processing'; // Or 'uploading', depending on your exact flow stages.
                videoRecord.processingStartedAt = videoRecord.processingStartedAt || new Date(); 
                await videoRecord.save();
                res.status(200).send('Webhook processed: Cloudinary eager transformations still pending.');
            }

        } else if (status === 'failed') {
            console.error(`[WebhookController] Cloudinary processing failed for ${public_id}. Error details: ${error}`);
            videoRecord.status = 'failed'; 
            videoRecord.errorMessage = `Cloudinary processing failed: ${error || 'Unknown error'}`;
            videoRecord.processingCompletedAt = new Date();
            await videoRecord.save();
            res.status(200).send('Webhook processed: Cloudinary processing failed, status updated.');
        } else {
            console.warn(`[WebhookController] Received unexpected Cloudinary processing status '${status}' for public_id: ${public_id}. No action taken.`);
            res.status(200).send('Notification type not handled.');
        }

    } else {
        console.log(`[WebhookController] Received unhandled Cloudinary notification type: '${notification_type}'.`);
        res.status(200).send('Notification type not handled.');
    }
});

/**
 * Gets all video records for the authenticated user.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const getUserVideos = asyncHandler(async (req, res) => {
    // FIX: Use 'user' as per VideoSchema (Video model expects 'user' field for ID)
    const videos = await Video.find({ user: req.user._id }).sort({ uploadStartedAt: -1 }); 
    res.status(200).json({ videos });
});

/**
 * Checks the status of a specific video and returns its details and analysis if available.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
const checkVideoStatus = asyncHandler(async (req, res) => {
    const videoId = req.params.videoId;
    const userId = req.user._id;

    if (!videoId) {
        res.status(400);
        throw new Error('Video ID is required.');
    }

    const video = await Video.findById(videoId);

    if (!video) {
        res.status(404);
        throw new Error('Video record not found.');
    }

    // Ensure the user is authorized to view this video's status
    // FIX: Use 'user' as per VideoSchema (Video model has 'user' field for ID)
    if (video.user.toString() !== userId.toString()) {
        res.status(403);
        throw new Error('Not authorized to view this video status.');
    }

    // If analysisId exists and status is 'analyzed' or 'failed', try to fetch analysis
    // FIX: Use 'analysis' field directly from video object
    let analysisData = null;
    if (video.analysis && (video.status === 'analyzed' || video.status === 'failed')) {
        try {
            analysisData = await Analysis.findById(video.analysis); // Use video.analysis as the ObjectId
        } catch (err) {
            console.error(`[checkVideoStatus] Error fetching analysis ${video.analysis}:`, err);
        }
    }

    res.status(200).json({
        _id: video._id,
        videoName: video.videoName,
        status: video.status,
        errorMessage: video.errorMessage || null,
        uploadStartedAt: video.uploadStartedAt, // Use the new timestamp field
        videoUrl: video.videoUrl, // Include the video URL for frontend preview
        analysisId: video.analysis, // Return the ID as analysisId
        analysisData: analysisData // Include analysis data if available
    });
});

module.exports = {
    uploadVideo,
    getUserVideos,
    handleCloudinaryWebhook,
    checkVideoStatus
};
