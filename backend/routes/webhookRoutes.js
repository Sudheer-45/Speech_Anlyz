// backend/controllers/videoController.js
const crypto = require('crypto');
const Video = require('../models/Video'); // Ensure this model exists

// Util function to verify Cloudinary webhook signature
const verifySignature = (rawBody, timestamp, receivedSignature) => {
  const payload = `timestamp=${timestamp}${rawBody}`;
  const expectedSignature = crypto
    .createHash('sha1')
    .update(payload + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return expectedSignature === receivedSignature;
};

// Webhook handler
const handleCloudinaryWebhook = async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const data = JSON.parse(rawBody);
    const timestamp = data.timestamp;
    const receivedSignature = req.headers['x-cld-signature'];

    if (!verifySignature(rawBody, timestamp, receivedSignature)) {
      console.warn('[WebhookController] Webhook signature verification failed!');
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }

    const publicId = data.public_id;
    const video = await Video.findOne({ public_id });

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    video.status = 'Analyzing';
    video.cloudinaryUrl = data.secure_url;
    await video.save();

    console.log('[WebhookController] Video updated successfully:', video._id);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[WebhookController] Error processing webhook:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  handleCloudinaryWebhook,
};
