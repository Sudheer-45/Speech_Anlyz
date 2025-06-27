// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Simulated Analysis Pipeline
const runAnalysisPipeline = async (videoUrl, userId, videoId) => {
  const grammar = {
    totalMistakes: 2,
    corrections: [
      { incorrect: "He go to school", correct: "He goes to school" },
      { incorrect: "She like apple", correct: "She likes apples" },
    ],
  };

  const sentiment = {
    label: "Positive",
    confidence: 0.91,
  };

  const fluencyScore = 78;
  const coherenceScore = 85;

  return await Analysis.create({
    video: videoId,
    user: userId,
    grammar,
    sentiment,
    fluencyScore,
    coherenceScore,
  });
};

// ✅ Upload video and initiate Cloudinary upload
const uploadVideo = asyncHandler(async (req, res) => {
  const { videoName } = req.body;
  const userId = req.user._id;
  const file = req.file;

  if (!file?.buffer) {
    res.status(400);
    throw new Error('No video file uploaded');
  }

  if (!videoName) {
    res.status(400);
    throw new Error('Video name is required');
  }

  const publicId = `video-${userId}-${Date.now()}`;
  const notificationUrl = `${process.env.RENDER_BACKEND_URL}/api/webhook`;

  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'comm-analyzer/videos',
        resource_type: 'video',
        public_id: publicId,
        eager: [
          {
            format: 'mp4',
            quality: 'auto:eco',
            crop: 'limit',
            width: 1280,
            height: 720,
          },
        ],
        eager_async: true,
        notification_url: notificationUrl,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });

  const newVideo = await Video.create({
    user: userId,
    filename: file.originalname,
    videoName,
    cloudinaryPublicId: publicId,
    status: 'Cloudinary Uploading',
    bytes: file.size,
    mimetype: file.mimetype,
    uploadStartedAt: new Date(),
  });

  res.status(202).json({
    message: 'Upload initiated.',
    videoRecordId: newVideo._id,
    publicId: newVideo.cloudinaryPublicId,
    videoName: newVideo.videoName,
    status: newVideo.status,
  });
});

// ✅ Webhook handler (Cloudinary → us)
const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-cld-signature'];
  const timestamp = req.body.timestamp;

  if (!signature || !timestamp) {
    return res.status(400).json({ message: 'Missing signature or timestamp' });
  }

  const expectedSignature = crypto
    .createHash('sha1')
    .update(timestamp + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('[Webhook] Invalid signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const { public_id, secure_url } = req.body;

  const video = await Video.findOne({ cloudinaryPublicId: public_id });

  if (!video) {
    return res.status(404).json({ message: 'Video not found' });
  }

  video.videoUrl = secure_url;
  video.status = 'Analyzing';
  await video.save();

  const analysis = await runAnalysisPipeline(secure_url, video.user, video._id);

  video.status = 'Completed';
  video.analysis = analysis._id;
  await video.save();

  res.status(200).json({ message: 'Video analyzed and analysis saved.' });
});

// ✅ Get user's videos
const getUserVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ user: req.user._id }).sort({ uploadStartedAt: -1 });
  res.status(200).json({ videos });
});

// ✅ Check video status
const checkVideoStatus = asyncHandler(async (req, res) => {
  const videoId = req.params.videoId;
  const video = await Video.findById(videoId);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (video.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Unauthorized');
  }

  let analysis = null;
  if (video.analysis) {
    analysis = await Analysis.findById(video.analysis);
  }

  res.status(200).json({
    _id: video._id,
    videoName: video.videoName,
    status: video.status,
    videoUrl: video.videoUrl,
    errorMessage: video.errorMessage || null,
    uploadStartedAt: video.uploadStartedAt,
    analysisId: video.analysis,
    analysisData: analysis,
  });
});

module.exports = {
  uploadVideo,
  getUserVideos,
  handleCloudinaryWebhook,
  checkVideoStatus,
};
