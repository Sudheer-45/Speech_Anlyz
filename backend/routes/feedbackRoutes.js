const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/authMiddleware');

// POST /api/feedback/submit
router.post('/submit', protect, async (req, res) => {
  try {
    const { feedbackType, message, rating } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }
    if (!['General', 'Bug', 'Feature Request', 'Support'].includes(feedbackType)) {
      return res.status(400).json({ message: 'Invalid feedback type' });
    }
    if (rating && (typeof rating !== 'number' || rating < 0 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be a number between 0 and 5' });
    }

    // Create feedback document
    const feedback = new Feedback({
      userId: req.user._id,
      feedbackType,
      message,
      rating: rating || 0,
      submittedAt: new Date()
    });

    // Save feedback to database
    await feedback.save();

    // Skip email for testing
    console.log('Feedback saved, skipping email');

    res.status(201).json({ message: 'Feedback submitted successfully' });
  
  } catch (err) {
    console.error('Feedback submission error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;