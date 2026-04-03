const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['speaking', 'listening', 'vocabulary', 'grammar', 'pronunciation'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 10,
    max: 100
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 1,
    max: 30
  },
  requirements: {
    type: Object,
    default: {}
  },
  prompt: {
    type: String,
    required: true
  },
  example: {
    type: String,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  dailyChallenge: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for daily challenges
challengeSchema.index({ dailyChallenge: 1, date: 1 });

const Challenge = mongoose.model('Challenge', challengeSchema);

module.exports = Challenge;