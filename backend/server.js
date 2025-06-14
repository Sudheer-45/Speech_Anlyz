// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // Ensure path is imported
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config(); // This loads variables from your .env file

// Connect to database
connectDB();

const app = express();

// CORS middleware - CRUCIAL FIX HERE
app.use(cors({
    origin: process.env.CORS_ORIGIN, // <--- CHANGE THIS LINE to read from environment variable
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Body parser for JSON data
app.use(express.json());
// Body parser for URL-encoded data (often needed for forms)
app.use(express.urlencoded({ extended: false }));

// Serve static uploaded files (videos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // This line is crucial for video playback

// NEW: Serve static uploaded profile images
app.use('/uploads/profile-images', express.static(path.join(__dirname, 'uploads', 'profile-images')));

// Rate limiting middleware setup
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10 // 10 requests per window
});

// Apply rate limiting to specific routes
app.use('/api/feedback', limiter); // Apply limiter middleware
app.use('/api/feedback', require('./routes/feedbackRoutes')); // Then apply the route handler

// Routes
app.use('/api/auth', require('./routes/auth')); // This correctly points to your auth routes
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


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
