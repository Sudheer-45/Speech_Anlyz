// backend/server.js
const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const Video = require('./models/Video');

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS Setup
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// ✅ Ensure preflight requests work (CORS OPTIONS)
app.options('*', cors());

// ✅ Webhook raw body parser (for Cloudinary)
app.use('/api/analysis/cloudinary-webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  try {
    req.body = JSON.parse(req.rawBody);
  } catch (e) {
    console.error('Error parsing Cloudinary webhook raw body:', e);
    req.body = {};
  }
  next();
});

// ✅ Normal body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Rate limiter for feedback
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
});

// ✅ Stalled video checker
const checkStalledVideos = async () => {
  try {
    const stalledVideos = await Video.find({
      status: { $in: ['Cloudinary Uploading', 'Analyzing'] },
      updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }
    });

    if (stalledVideos.length > 0) {
      console.warn(`Found ${stalledVideos.length} potentially stalled videos.`);
      // Optional recovery logic...
    }
  } catch (err) {
    console.error('Error checking stalled videos:', err);
  }
};
setInterval(checkStalledVideos, 30 * 60 * 1000);

// ✅ Routes
app.use('/api/feedback', limiter);
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/video'));
app.use('/api/user', require('./routes/user'));
app.use('/api/analysis', require('./routes/analysisRoutes'));

// ✅ Health check
app.get('/', (req, res) => {
  res.send('Speech Analyzer API is running...');
});

// ✅ Global error handler
app.use(errorHandler);

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
