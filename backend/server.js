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

// 🛡️ Webhook route using raw body for signature verification
const expressRaw = express.raw({ type: 'application/json' });
const webhookHandler = require('./routes/webhookRoutes');
app.use('/api/webhook', expressRaw, (req, res, next) => {
    req.rawBody = req.body.toString('utf8'); // Attach rawBody string for signature
    next();
}, webhookHandler);

// Parse body for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Static uploads path
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiter for feedback endpoint
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});

// Scheduled job for stalled video recovery
const checkStalledVideos = async () => {
    try {
        const stalledVideos = await Video.find({
            status: { $in: ['Cloudinary Uploading', 'Analyzing'] },
            updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }
        });

        if (stalledVideos.length > 0) {
            console.warn(`Found ${stalledVideos.length} stalled videos.`);
        }
    } catch (err) {
        console.error('Error checking stalled videos:', err);
    }
};
setInterval(checkStalledVideos, 30 * 60 * 1000);

// All other routes
app.use('/api/feedback', limiter);
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/video'));
app.use('/api/user', require('./routes/user'));
app.use('/api/analysis', require('./routes/analysisRoutes'));

// Health check
app.get('/', (req, res) => {
    res.send('Speech Analyzer API is running...');
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
