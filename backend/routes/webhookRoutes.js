const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController');

router.post('/cloudinary', express.json(), handleCloudinaryWebhook);

module.exports = router;
