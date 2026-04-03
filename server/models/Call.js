const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['voice', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'accepted', 'rejected', 'ended', 'missed', 'failed'],
    default: 'initiated'
  },
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: 0 // in seconds
  },
  callRecording: {
    type: String,
    default: null
  },
  quality: {
    type: String,
    enum: ['poor', 'good', 'excellent'],
    default: 'good'
  },
  iceServers: {
    type: Object,
    default: null
  }
}, {
  timestamps: true
});

// Calculate duration when call ends
callSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'ended' && this.startedAt) {
    this.endedAt = new Date();
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  next();
});

// Index for faster queries
callSchema.index({ caller: 1, receiver: 1, createdAt: -1 });
callSchema.index({ status: 1, createdAt: -1 });

const Call = mongoose.model('Call', callSchema);

module.exports = Call;