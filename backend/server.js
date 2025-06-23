// backend/server.js
// This file has a minor change related to Cloudinary:
// The line serving static '/uploads/profile-images' is removed.

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); 
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const videoRoutes = require('./routes/video');

// Load env vars
dotenv.config(); 

// Connect to database
connectDB();

const app = express();

// CORS middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Body parser for JSON data
app.use(express.json());
// Body parser for URL-encoded data
app.use(express.urlencoded({ extended: false }));

// Serve static uploaded VIDEO files (if you are still storing videos locally)
// If you move videos to Cloudinary later, this line would also be removed.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 

// REMOVED: Serving static uploaded profile images, as they're now on Cloudinary
// (The line 'app.use('/uploads/profile-images', express.static(path.join(__dirname, 'uploads', 'profile-images')));'
// should be removed if it exists in your original server.js)


// Rate limiting middleware setup
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10 
});

// In your server.js or a separate service
const checkStalledVideos = async () => {
    const stalledVideos = await Video.find({
        status: { $in: ['processing', 'processed'] },
        updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes old
    });
    
    for (const video of stalledVideos) {
        console.log(`Checking stalled video: ${video._id}`);
        // Implement your verification and recovery logic here
    }
};

// Run every 30 minutes
setInterval(checkStalledVideos, 30 * 60 * 1000);
// Apply rate limiting to specific routes
app.use('/api/feedback', limiter); 
app.use('/api/feedback', require('./routes/feedbackRoutes')); 

// Routes
app.use('/api/auth', require('./routes/auth')); 
app.use('/api', require('./routes/video'));
app.use('/api/user', require('./routes/user'));
app.use('/api/analysis', require('./routes/analysisRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));


// Basic route for testing
app.get('/', (req, res) => {
    res.send('Speech Analyzer API is running...');
});

// Error handling middleware (should be last)
app.use(errorHandler);
app.use('/api/videos', videoRoutes);

// Add these near your other route imports
const webhookRoutes = require('./routes/webhookRoutes');

// Add this with your other app.use() calls
app.use('/api/webhooks', webhookRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
