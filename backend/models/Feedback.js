const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  feedbackType: { type: String, enum: ['General', 'Bug', 'Feature Request', 'Support'], required: true },
  message: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);