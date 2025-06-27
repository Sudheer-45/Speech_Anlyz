// backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController');

// This handles the POST request from Cloudinary webhook
router.post('/', handleCloudinaryWebhook);

module.exports = router;
