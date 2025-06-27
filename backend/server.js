// backend/server.js
const express = require('express');
const dotenv = require('dotenv').config(); // Load env vars
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Import necessary models if used directly in server.js (e.g., for stalled video check)
const Video = require('./models/Video'); // Ensure Video model is imported

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
// This middleware is specific to the Cloudinary webhook route.
// It MUST parse the raw body as a string for signature verification.
// It MUST be placed before `express.json()` IF the webhook route
// is defined as part of the general `app.use(express.json())` flow,
// or applied directly to the route like shown in analysisRoutes.js.
// Since your analysisRoutes.js defines the webhook:
// router.post('/cloudinary-webhook', handleCloudinaryWebhook);
// And server.js mounts analysisRoutes at /api/analysis:
// app.use('/api/analysis', require('./routes/analysisRoutes'));
// The full webhook path will be /api/analysis/cloudinary-webhook.
// We need to apply `express.raw` specifically to this path.
// This is typically done by creating a dedicated route, or carefully ordering middleware.

// METHOD 1: Apply express.raw directly to the webhook route in analysisRoutes.js
// (This is the cleanest, recommended approach)
// Let's assume handleCloudinaryWebhook takes care of parsing its own raw body
// or that analysisRoutes.js directly uses `express.raw` for that one route.
// IF not, we put it here:
app.use('/api/analysis/cloudinary-webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    // This middleware will run ONLY for the Cloudinary webhook.
    // express.raw() has already put the raw buffer in req.body.
    req.rawBody = req.body.toString('utf8'); // Convert buffer to string
    try {
        // Parse the raw body string into req.body as a JSON object
        req.body = JSON.parse(req.rawBody);
    } catch (e) {
        console.error('Error parsing Cloudinary webhook raw body as JSON:', e);
        req.body = {}; // Fallback
    }
    next(); // Pass control to handleCloudinaryWebhook
});


// Regular Body parser for JSON data (applied to all other routes, after webhook raw parser)
app.use(express.json());
// Body parser for URL-encoded data (applied to all other routes)
app.use(express.urlencoded({ extended: false }));


// Serve static uploaded VIDEO files (if you are still storing videos locally)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Rate limiting middleware setup
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});

// Check for stalled videos (ensure Video model is imported above)
const checkStalledVideos = async () => {
    try {
        const stalledVideos = await Video.find({
            status: { $in: ['Cloudinary Uploading', 'Analyzing'] }, // Check for videos stuck in these states
            updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes old
        });

        if (stalledVideos.length > 0) {
            console.warn(`Found ${stalledVideos.length} potentially stalled videos. Reviewing...`);
            // You might want to add more robust logic here to handle them
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
// NOTE: Make sure your route files export an Express Router instance.
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/video')); // This mounts video.js at /api, so /upload becomes /api/upload, /user/videos becomes /api/user/videos, /status/:videoId becomes /api/status/:videoId
app.use('/api/user', require('./routes/user'));
app.use('/api/analysis', require('./routes/analysisRoutes')); // This mounts analysisRoutes.js at /api/analysis
// Check for redundancy: If './routes/video' handles /api/upload, then this line is likely problematic.
// For now, removing it to avoid potential conflicts with the /api/upload route in video.js.
// app.use('/api/upload', require('./routes/uploadRoutes'));


// Basic route for testing
app.get('/', (req, res) => {
    res.send('Speech Analyzer API is running...');
});

// Error handling middleware (should be last)
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
