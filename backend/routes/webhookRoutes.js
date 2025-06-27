// backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController');

// This middleware specifically for raw body parsing.
// It should be placed BEFORE any other body parsing middleware (like express.json())
// for the paths it's intended to handle.
router.use(express.text({ type: '*/*' })); // Parses all incoming request bodies as raw text

// Custom middleware to set req.rawBody and then attempt to parse req.body as JSON
router.use((req, res, next) => {
    // req.body from express.text() will be the raw string if type: '*/*' is used
    if (typeof req.body === 'string' && req.body.length > 0) {
        req.rawBody = req.body; // Store the raw string
        try {
            // Attempt to parse as JSON for the controller to use req.body as an object
            req.body = JSON.parse(req.rawBody);
        } catch (e) {
            console.warn('[WebhookMiddleware] Could not parse raw body as JSON, proceeding with raw string for signature verification.', e.message);
            // If parsing fails, req.body remains the raw string, handleCloudinaryWebhook must use req.rawBody
        }
    } else {
        // If req.body is not a string (e.g., empty or unexpected type), set rawBody to undefined/null
        req.rawBody = undefined;
        console.warn('[WebhookMiddleware] req.body was not a string or was empty for raw body capture.');
    }
    next();
});

// POST route for Cloudinary webhooks
// This endpoint receives notifications from Cloudinary when video processing is done.
// The full path in server.js is /api/webhook, so this becomes /api/webhook/
router.post('/', handleCloudinaryWebhook);

module.exports = router;
