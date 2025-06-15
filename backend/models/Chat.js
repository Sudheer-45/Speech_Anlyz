const mongoose = require('mongoose');

const chatSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    role: { type: String, required: true, enum: ['user', 'model'] },
    parts: [{ text: { type: String, required: true } }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
