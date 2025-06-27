// backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController'); // Import the handler

// Middleware to get raw body for signature verification (specific to this route)
router.use(express.raw({ type: 'application/json' })); // Important: Apply raw body parser
router.use((req, res, next) => {
    // Convert raw buffer body to string for Cloudinary signature verification
    if (req.body) {
        req.rawBody = req.body.toString('utf8');
        try {
            // Re-parse the body as JSON for controller logic, if needed
            req.body = JSON.parse(req.rawBody);
        } catch (e) {
            console.warn('[WebhookMiddleware] Could not parse raw body as JSON, proceeding with raw string:', e.message);
            // If it fails, req.body will remain the buffer, handle in controller if expecting object
        }
    }
    next();
});

// POST route for Cloudinary webhooks
// This endpoint receives notifications from Cloudinary when video processing is done.
// Full path will be /api/webhook as mounted in server.js
router.post('/', handleCloudinaryWebhook);

module.exports = router;
