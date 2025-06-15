const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { protect } = require('../middleware/authMiddleware');
const Chat = require('../models/Chat');
const multer = require('multer');

// Multer for audio uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
      throw new Error('LanguageTool API call failed.');
    }
    const data = await response.json();
    console.log('LanguageTool response:', data);
    const score = Math.max(0, 100 - data.matches.length * 5); // Ensure score >= 0
    return { score, issues: data.matches };
  } catch (error) {
    console.error('LanguageTool error:', error.message);
    return { score: 80, issues: [] }; // Fallback score
  }
};

// Parse Gemini response (simplified regex-based parsing)
const parseGeminiResponse = (text) => {
  const toneMatch = text.match(/tone:\s*(\w+)/i);
  const tipsMatch = text.match(/tips:\s*([\s\S]*)/i);
  const tone = toneMatch ? toneMatch[1] : 'Neutral';
  const tips = tipsMatch
    ? tipsMatch[1].split('\n').filter(t => t.trim()).slice(0, 3)
    : ['Practice clear enunciation.', 'Vary your pitch for engagement.'];
  return { tone, tips };
};

router.post('/message', protect, upload.single('audio'), asyncHandler(async (req, res) => {
  const { message, isVoice } = req.body;
  const audio = req.file;
  const userId = req.user._id;

  if (!message && !audio) {
    res.status(400);
    throw new Error('Message or audio content is required.');
  }

  try {
    // Fetch or initialize chat history
    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, messages: [] });
    }
    const userChatHistory = chat.messages;

    // Process message or audio
    let textToProcess = message;
    if (audio && isVoice) {
      console.log('Audio received, size:', audio.size);
      textToProcess = '[Audio transcription placeholder]';
      // TODO: Integrate Google Speech-to-Text with SPEECH_ANALYSIS_API_KEY
    }

    if (!textToProcess) {
      throw new Error('No text available for processing.');
    }

    // Add user message to history
    const userMessage = { role: 'user', parts: [{ text: textToProcess }] };
    userChatHistory.push(userMessage);

    // Prepare analysis for voice input
    let analysis = null;
    if (isVoice) {
      // Grammar via LanguageTool
      const grammarResult = await analyzeGrammar(textToProcess);

      // Tone and tips via Gemini
      const prompt = `Analyze this speech for tone and tips (do not analyze grammar, just tone and improvement tips). Return in format: Tone: [tone]\nTips:\n- [tip1]\n- [tip2]\n- [tip3]\nSpeech: "${textToProcess}"`;
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

    const apiKey = process.env.GEMINI_API_KEY || '';
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
    console.log(`Received response from Gemini API for user ${userId}:`, result);

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
    console.error(`Error in chatbot API for user ${userId}:`, error);
    if (error.message.includes('Gemini API call failed')) {
      res.status(502).json({ message: 'Failed to connect to the language model.' });
    } else if (isVoice) {
      res.status(500).json({ message: 'Failed to analyze speech input.' });
    } else {
      res.status(500).json({ message: 'Failed to get a chatbot response.' });
    }
  }
}));

module.exports = router;
