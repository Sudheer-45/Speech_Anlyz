// backend/routes/chatbot.js
const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware'); // Assuming chatbot is for logged-in users

// This endpoint will handle messages from the frontend and send them to the Gemini API
router.post('/message', protect, asyncHandler(async (req, res) => {
    // We expect the user's message in the request body
    const { message } = req.body;

    if (!message) {
        res.status(400);
        throw new Error('Message content is required.');
    }

    // You can optionally maintain chat history for context with the LLM
    // For now, we'll send just the current message.
    // If you want history, you'd send `contents: chatHistory` where chatHistory is an array
    // like [{ role: "user", parts: [{ text: "Hello" }] }, { role: "model", parts: [{ text: "Hi!" }] }, { role: "user", parts: [{ text: message }] }]

    try {
        // Prepare the payload for the Gemini API call
        const chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: message }] });

        const payload = {
            contents: chatHistory
            // generationConfig: {
            //     temperature: 0.7, // Adjust creativity (0.0 - 1.0)
            //     topP: 0.95,
            //     topK: 40,
            //     maxOutputTokens: 500, // Limit response length
            // },
        };

        // API Key is left as empty string; Canvas will inject it at runtime.
        const apiKey = ""; 
        // Using gemini-2.0-flash for text generation
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        console.log('Sending message to Gemini API...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API error response:', errorData);
            throw new Error(`Gemini API call failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log('Received response from Gemini API.');

        let botResponseText = 'Sorry, I could not generate a response.';
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            botResponseText = result.candidates[0].content.parts[0].text;
        } else {
            console.warn('Gemini API response structure unexpected:', result);
        }

        res.status(200).json({ reply: botResponseText });

    } catch (error) {
        console.error('Error in chatbot API route:', error);
        res.status(500).json({ message: 'Failed to get a response from the chatbot. Please try again later.' });
    }
}));

module.exports = router;
