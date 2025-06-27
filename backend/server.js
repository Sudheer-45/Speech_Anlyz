// backend/server.js
const express = require('express');
const dotenv = require('dotenv').config(); // Load env vars
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// --- Middleware for Cloudinary Webhook Raw Body Parsing ---
// This MUST be applied ONLY to the webhook route and BEFORE express.json()
// for that specific route.
app.use('/api/cloudinary-webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    // Cloudinary sends JSON, but we need the raw string for signature verification.
    // express.raw() puts the raw buffer into req.body by default.
    // We'll store it as req.rawBody and then parse it as JSON into req.body
    if (req.body) { // If express.raw() has already populated req.body with buffer
        req.rawBody = req.body.toString('utf8'); // Convert buffer to string
        try {
            // Attempt to parse the raw body into req.body as JSON
            req.body = JSON.parse(req.rawBody);
        } catch (e) {
            console.error('Error parsing Cloudinary webhook raw body as JSON:', e);
            // If parsing fails, proceed but acknowledge issue.
            req.body = {}; // Fallback
        }
    } else {
        // Fallback if req.body is not populated by express.raw for some reason
        console.warn('req.body not found after express.raw for webhook. Raw body might be missing.');
        req.rawBody = '';
    }
    next();
});

// Regular Body parser for JSON data (applied to all other routes)
app.use(express.json());
// Body parser for URL-encoded data (applied to all other routes)
app.use(express.urlencoded({ extended: false }));


// Serve static uploaded VIDEO files (if you are still storing videos locally)
// If you move videos to Cloudinary later, this line would also be removed.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Rate limiting middleware setup
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});

// In your server.js or a separate service (Assuming Video model is imported or globally available)
const Video = require('./models/Video'); // Ensure Video model is imported if used here
const checkStalledVideos = async () => {
    try {
        const stalledVideos = await Video.find({
            status: { $in: ['Cloudinary Uploading', 'Analyzing'] }, // Check for videos stuck in these states
            updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes old
        });

        if (stalledVideos.length > 0) {
            console.warn(`Found ${stalledVideos.length} potentially stalled videos. Reviewing...`);
        }

        for (const video of stalledVideos) {
            console.log(`Checking stalled video: ${video._id}, Status: ${video.status}, Last Updated: ${video.updatedAt}`);
            // You might want to:
            // 1. Log more details or send alerts.
            // 2. Potentially retry analysis if it's a transient failure (complex).
            // 3. Mark them as 'failed' if they consistently stall.
            // For now, we just log.
        }
    } catch (err) {
        console.error('Error checking for stalled videos:', err);
    }
};

// Run every 30 minutes (after server starts)
setInterval(checkStalledVideos, 30 * 60 * 1000);


// Apply rate limiting to specific routes
app.use('/api/feedback', limiter);
app.use('/api/feedback', require('./routes/feedbackRoutes'));

// Routes (Ensure these paths match your frontend axios calls)
app.use('/api/auth', require('./routes/auth')); // Assuming auth routes
app.use('/api', require('./routes/video')); // This should typically be a base for /api/upload
app.use('/api/user', require('./routes/user')); // User profile, settings etc.
app.use('/api/analysis', require('./routes/analysisRoutes')); // Analysis and dashboard routes (including webhook)
app.use('/api/upload', require('./routes/uploadRoutes')); // If this is separate from videoRoutes, check for overlap

// Basic route for testing
app.get('/', (req, res) => {
    res.send('Speech Analyzer API is running...');
});

// Error handling middleware (should be last)
app.use(errorHandler);

// Remove the redundant app.use('/api/videos', videoRoutes); if videoRoutes is already used above.
// If videoRoutes handles different paths than /api/upload etc., keep it.
// Assuming videoRoutes is the file 'video.js' you provided that has the /upload POST route.
// If './routes/uploadRoutes' is also defining /api/upload, you will have conflicts.
// Please ensure only one definition for /api/upload exists.
// Based on previous code, video.js handles /api/upload, so /api/upload route here is likely redundant or misnamed.
// Let's assume you intended '/api' to catch all video related routes.
// If you have a separate file for uploadRoutes with its own / route, then it would apply.
// For now, commenting out if it conflicts with video.js.
// app.use('/api/upload', require('./routes/uploadRoutes')); // POTENTIAL CONFLICT

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
