// backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController'); // Import the handler

// IMPORTANT: This middleware needs to be before the route handler to ensure req.rawBody is available.
// It parses the incoming webhook body as a raw buffer and then stringifies it for signature verification.
router.use(express.raw({ type: 'application/json' }));
router.use((req, res, next) => {
    if (req.body) {
        req.rawBody = req.body.toString('utf8'); // Convert buffer to string
        try {
            req.body = JSON.parse(req.rawBody); // Try to re-parse as JSON for controller access
        } catch (e) {
            console.warn('[WebhookMiddleware] Could not parse raw body as JSON, proceeding with raw string:', e.message);
            // If JSON parsing fails, req.body will remain the buffer, which handleCloudinaryWebhook might not like.
            // However, req.rawBody (the string) is explicitly passed to api_sign_request.
        }
    }
    next();
});

// POST route for Cloudinary webhooks
// This endpoint receives notifications from Cloudinary when video processing is done.
// The full path in server.js is /api/webhook, so this becomes /api/webhook/
router.post('/', handleCloudinaryWebhook);

module.exports = router;
