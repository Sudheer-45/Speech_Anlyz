const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');
const Chat = require('../models/Chat');
const mongoose = require('mongoose');

let fetch;
try {
  fetch = require('node-fetch'); // Use node-fetch for Node < 18
} catch (error) {
  console.warn('node-fetch not found; assuming native fetch is available.');
  fetch = globalThis.fetch; // Node 18+ has native fetch
}

const multer = require('multer');

// Multer for audio uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Validate environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables.');
}
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set in environment variables.');
}

// LanguageTool grammar analysis
const analyzeGrammar = async (text) => {
  try {
    console.log('Sending text to LanguageTool API...');
    const response = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURIComponent(text)}&language=en-US`
    });
    if (!response.ok) {
      console.error('LanguageTool API error:', response.status);
      throw new Error(`LanguageTool API call failed with status ${response.status}`);
    }
    const data = await response.json();
    console.log('LanguageTool response:', { matches: data.matches });
    const score = Math.max(0, 100 - data.matches.length * 5);
    return { score, issues: data.matches };
  } catch (error) {
    console.error('LanguageTool error:', error.message);
    return { score: 80, issues: [] };
  }
};

// Parse Gemini response
const parseGeminiResponse = (text) => {
  const toneMatch = text.match(/tone:\s*(\w+)/i);
  const tipsMatch = text.match(/tips:\s*([\s\S]*)/i);
  const tone = toneMatch ? toneMatch[1] : 'Neutral';
  const tips = tipsMatch
    ? tipsMatch[1]
        .split('\n')
        .filter(t => t.trim().startsWith('-'))
        .map(t => t.replace(/^-/, '').trim())
        .slice(0, 3)
    : ['Practice clear enunciation.', 'Vary your pitch for engagement.', 'Pause between ideas.'];
  return { tone, tips };
};

router.post('/message', protect, upload.single('audio'), asyncHandler(async (req, res) => {
  const { message, isVoice } = req.body;
  const audio = req.file;
  const userId = req.user._id;

  // Log request details
  console.log(`Received request for user ${userId}:`, { message, isVoice, audio: !!audio });

  // Validate input
  if (!message && !audio) {
    console.error('Invalid input: No message or audio provided.');
    res.status(400);
    throw new Error('Message or audio content is required.');
  }

  try {
    // Verify MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected:', mongoose.connection.readyState);
      throw new Error('Database connection failed.');
    }

    // Fetch or initialize chat history
    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, messages: [] });
    }
    const userChatHistory = chat.messages;

    // Process message or audio
    let textToProcess = message;
    if (audio && isVoice) {
      console.log('Audio received, size:', audio.size, 'bytes');
      textToProcess = '[Audio transcription placeholder]';
    }

    if (!textToProcess) {
      console.error('No text available for processing.');
      throw new Error('No text available for processing.');
    }

    // Add user message to history
    const userMessage = { role: 'user', parts: [{ text: textToProcess }] };
    userChatHistory.push(userMessage);

    // Prepare analysis for voice input
    let analysis = null;
    if (isVoice) {
      const grammarResult = await analyzeGrammar(textToProcess);
      const prompt = `Analyze this speech for tone and improvement tips (do not analyze grammar). Return in format:\nTone: [tone]\nTips:\n- [tip1]\n- [tip2]\n- [tip3]\nSpeech: "${textToProcess}"`;
      userChatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }

    // Gemini API payload
    const payload = {
      contents: userChatHistory,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 500
      }
    };

    // Gemini API call
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing.');
      throw new Error('Gemini API key is not configured.');
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    console.log(`Sending message to Gemini API for user ${userId}...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API call failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log(`Received response from Gemini API for user ${userId}.`);

    // Process Gemini response
    let botResponseText = 'Sorry, I could not generate a response.';
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      botResponseText = result.candidates[0].content.parts[0].text;
      userChatHistory.push({ role: 'model', parts: [{ text: botResponseText }] });
      if (userChatHistory.length > 10) {
        userChatHistory.splice(0, userChatHistory.length - 10);
      }
      chat.messages = userChatHistory;
      await chat.save();
    } else {
      console.warn('Gemini API response unexpected:', result);
    }

    // Finalize analysis for voice input
    if (isVoice) {
      const { tone, tips } = parseGeminiResponse(botResponseText);
      analysis = {
        grammar: grammarResult.score,
        tone,
        tips
      };
      console.log('Speech analysis result:', analysis);
      return res.status(200).json({
        reply: { text: 'Here’s your speech analysis:', analysis }
      });
    }

    res.status(200).json({ reply: botResponseText });

  } catch (error) {
    console.error(`Error in chatbot API for user ${userId}:`, error.message, error.stack);
    if (error.message.includes('Gemini API call failed')) {
      res.status(502).json({ message: 'Failed to connect to the language model.' });
    } else if (error.message.includes('LanguageTool API call failed')) {
      res.status(502).json({ message: 'Failed to analyze grammar.' });
    } else if (error.message.includes('Database connection failed')) {
      res.status(500).json({ message: 'Database connection error.' });
    } else if (isVoice) {
      res.status(500).json({ message: 'Failed to analyze speech input.' });
    } else {
      res.status(500).json({ message: 'Failed to get a chatbot response.' });
    }
  }
}));

module.exports = router;
