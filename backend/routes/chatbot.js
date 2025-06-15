const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');

// In-memory chat history (for simplicity; use a database for production)
const chatHistories = new Map(); // Map<userId, Array<{ role: string, parts: Array<{ text: string }> }>>

// Simulate speech analysis (replace with actual logic if available)
const simulateSpeechAnalysis = (message) => {
  // Mock analysis based on message content (e.g., length, keywords)
  const wordCount = message.split(/\s+/).length;
  const grammarScore = Math.min(90, 80 + wordCount * 0.5); // Simple heuristic
  const tone = wordCount > 10 ? 'Confident' : 'Neutral'; // Basic tone detection
  const tips = [
    wordCount < 5 ? 'Try speaking in longer sentences for clarity.' : 'Good sentence length!',
    'Practice pausing between ideas for emphasis.',
    grammarScore < 85 ? 'Review grammar rules for complex sentences.' : 'Great grammar!'
  ];
  return {
    grammar: Math.round(grammarScore),
    tone,
    tips
  };
};

router.post('/message', protect, asyncHandler(async (req, res) => {
  const { message, isVoice } = req.body;
  const userId = req.user._id; // From protect middleware

  if (!message || typeof message !== 'string') {
    res.status(400);
    throw new Error('Message content is required and must be a string.');
  }

  try {
    // Initialize or retrieve chat history for the user
    if (!chatHistories.has(userId)) {
      chatHistories.set(userId, []);
    }
    const userChatHistory = chatHistories.get(userId);

    // Add user message to history
    const userMessage = { role: 'user', parts: [{ text: message }] };
    userChatHistory.push(userMessage);

    // Prepare Gemini API payload
    const payload = {
      contents: userChatHistory,
      generationConfig: {
        temperature: 0.7, // Balanced creativity
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 500 // Limit response length
      }
    };

    const apiKey = process.env.GEMINI_API_KEY || ''; // Ensure set in environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    console.log(`Sending message to Gemini API for user ${userId}...`);
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
    console.log(`Received response from Gemini API for user ${userId}.`);

    let botResponseText = 'Sorry, I could not generate a response.';
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      botResponseText = result.candidates[0].content.parts[0].text;
      // Add bot response to history
      userChatHistory.push({ role: 'model', parts: [{ text: botResponseText }] });
      // Limit history to last 10 messages to prevent overflow
      if (userChatHistory.length > 10) {
        userChatHistory.splice(0, userChatHistory.length - 10);
      }
    } else {
      console.warn('Gemini API response structure unexpected:', result);
    }

    // Handle voice input
    if (isVoice) {
      const analysis = simulateSpeechAnalysis(message);
      return res.status(200).json({
        reply: {
          text: botResponseText,
          analysis
        }
      });
    }

    // Handle text input
    res.status(200).json({ reply: botResponseText });

  } catch (error) {
    console.error(`Error in chatbot API route for user ${userId}:`, error);
    if (error.message.includes('Gemini API call failed')) {
      res.status(502).json({ message: 'Failed to connect to the language model. Please try again later.' });
    } else if (isVoice) {
      res.status(500).json({ message: 'Failed to analyze speech input. Please try again or type your message.' });
    } else {
      res.status(500).json({ message: 'Failed to get a response from the chatbot. Please try again later.' });
    }
  }
}));

module.exports = router;
