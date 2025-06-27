// backend/controllers/videoController.js
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload video to Cloudinary and create DB record
const uploadVideo = asyncHandler(async (req, res) => {
  const { videoName } = req.body;
  const userId = req.user._id;
  const file = req.file;

  if (!file || !file.buffer) {
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
          { format: 'mp4', quality: 'auto:eco', crop: 'limit', width: 1280, height: 720 },
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
    userId,
    filename: file.originalname,
    videoName,
    publicId,
    status: 'uploading',
    bytes: file.size,
    mimetype: file.mimetype,
    uploadStartedAt: new Date(),
  });

  res.status(202).json({
    message: 'Upload initiated.',
    videoRecordId: newVideo._id,
    publicId: newVideo.publicId,
    videoName: newVideo.videoName,
    status: newVideo.status,
  });
});

// Get user's videos
const getUserVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ userId: req.user._id }).sort({ uploadStartedAt: -1 });
  res.status(200).json({ videos });
});

// Webhook from Cloudinary
const handleCloudinaryWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-cld-signature'];
  const timestamp = req.headers['x-cld-timestamp'];
  const rawBody = req.rawBody;

  if (!signature || !timestamp || !rawBody) {
    return res.status(400).send('Missing headers or body');
  }

  const expectedSig = cloudinary.utils.api_sign_request(JSON.parse(rawBody), process.env.CLOUDINARY_API_SECRET, timestamp);
  if (expectedSig !== signature) {
    console.warn('[Webhook] Invalid signature');
    return res.status(200).send('Invalid signature');
  }

  const { notification_type, public_id, secure_url, status, error, eager } = req.body;
  if (!public_id) return res.status(400).send('Missing public_id');

  const video = await Video.findOne({ publicId: public_id });
  if (!video) return res.status(404).send('Video not found');

  video.lastCheckedAt = new Date();

  if (status === 'completed') {
    const allEagerDone = eager ? eager.every(t => t.status === 'completed') : true;
    if (allEagerDone) {
      video.videoUrl = secure_url;
      video.status = 'processed';
      video.processingCompletedAt = new Date();
      await video.save();

      runAnalysisPipeline(
        video._id,
        secure_url,
        video.userId,
        video.filename,
        video.videoName,
        public_id
      );

      return res.status(200).send('Processed and analysis started');
    } else {
      video.status = 'processing';
      video.processingStartedAt = new Date();
      await video.save();
      return res.status(200).send('Awaiting eager transformations');
    }
  } else if (status === 'failed') {
    video.status = 'failed';
    video.errorMessage = error || 'Unknown error';
    video.processingCompletedAt = new Date();
    await video.save();
    return res.status(200).send('Processing failed');
  } else {
    return res.status(200).send('Unhandled status');
  }
});

// Check status of a video
const checkVideoStatus = asyncHandler(async (req, res) => {
  const videoId = req.params.videoId;
  const video = await Video.findById(videoId);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  if (video.userId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Unauthorized');
  }

  let analysis = null;
  if (video.analysisId) {
    analysis = await Analysis.findById(video.analysisId);
  }

  res.status(200).json({
    _id: video._id,
    videoName: video.videoName,
    status: video.status,
    videoUrl: video.videoUrl,
    errorMessage: video.errorMessage || null,
    uploadStartedAt: video.uploadStartedAt,
    analysisId: video.analysisId,
    analysisData: analysis
  });
});

module.exports = {
  uploadVideo,
  getUserVideos,
  handleCloudinaryWebhook,
  checkVideoStatus,
};
