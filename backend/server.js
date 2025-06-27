// backend/server.js
const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const rateLimit = require('express-rate-limit');
const Video = require('./models/Video');

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

// Webhook route must be mounted before express.json()
app.use('/api/webhook', require('./routes/webhookRoutes'));

// General middleware for body parsing (after webhook route)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static uploaded files (optional)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter for feedback endpoint
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});

// Scheduled job for checking stalled videos
const checkStalledVideos = async () => {
    try {
        const stalledVideos = await Video.find({
            status: { $in: ['Cloudinary Uploading', 'Analyzing'] },
            updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }
        });

        if (stalledVideos.length > 0) {
            console.warn(`Found ${stalledVideos.length} stalled videos.`);
            // Optional: add recovery logic here
        }
    } catch (err) {
        console.error('Error checking stalled videos:', err);
    }
};
setInterval(checkStalledVideos, 30 * 60 * 1000);

// Routes
app.use('/api/feedback', limiter);
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/video'));
app.use('/api/user', require('./routes/user'));
app.use('/api/analysis', require('./routes/analysisRoutes'));

// Basic health check route
app.get('/', (req, res) => {
    res.send('Speech Analyzer API is running...');
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
