const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActivityDate: {
    type: Date,
    default: Date.now
  },
  streakHistory: [{
    date: Date,
    active: Boolean
  }],
  milestones: [{
    day: Number,
    achievedAt: Date
  }]
}, {
  timestamps: true
});

// Pre-save middleware to update longest streak
streakSchema.pre('save', function(next) {
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  next();
});

const Streak = mongoose.model('Streak', streakSchema);

module.exports = Streak;