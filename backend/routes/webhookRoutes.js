// backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const { handleCloudinaryWebhook } = require('../controllers/videoController');
const getRawBody = require('raw-body'); // <-- This line requires 'raw-body' to be installed

// Custom middleware to capture the raw body as a buffer, always.
// It should be the first middleware used for this router to ensure it gets the body before other parsers consume it.
// We expect Cloudinary webhooks to be JSON, but this approach is more robust.
router.use(async (req, res, next) => {
    // Only process if the request has a body and is a POST request
    if (req.method === 'POST' && req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
        try {
            // Use raw-body to get the buffer, then convert to string
            const rawBodyBuffer = await getRawBody(req, {
                length: req.headers['content-length'],
                encoding: 'utf8' // Cloudinary webhooks are typically UTF-8 JSON
            });
            req.rawBody = rawBodyBuffer; // Store the raw string for signature verification

            // Attempt to re-parse the raw body string as JSON for req.body
            try {
                req.body = JSON.parse(rawBodyBuffer);
            } catch (jsonParseError) {
                // If it's not JSON, req.body will remain the raw string.
                // The controller should use req.rawBody for signature and be aware req.body might be a string.
                console.warn('[WebhookMiddleware] Could not parse raw body as JSON:', jsonParseError.message);
            }
        } catch (rawBodyError) {
            console.error('[WebhookMiddleware] Error capturing raw body:', rawBodyError.message);
            req.rawBody = undefined; // Ensure rawBody is explicitly undefined on error
        }
    } else {
        req.rawBody = undefined; // No body or not a POST, ensure rawBody is undefined
    }
    next();
});

// POST route for Cloudinary webhooks
// The full path when mounted in server.js at /api/webhook will be /api/webhook/
router.post('/', handleCloudinaryWebhook);

module.exports = router;
