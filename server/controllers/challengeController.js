const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');
const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get all challenges
// @route   GET /api/challenges
// @access  Private
const getChallenges = async (req, res) => {
  try {
    const { type, difficulty, daily } = req.query;
    
    const filter = { active: true };
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (daily === 'true') filter.dailyChallenge = true;
    
    const challenges = await Challenge.find(filter)
      .sort({ createdAt: -1 });
    
    // Get user progress for each challenge
    const userChallenges = await UserChallenge.find({
      user: req.user._id,
      challenge: { $in: challenges.map(c => c._id) }
    });
    
    const challengesWithProgress = challenges.map(challenge => {
      const progress = userChallenges.find(uc => 
        uc.challenge.toString() === challenge._id.toString()
      );
      
      return {
        ...challenge.toObject(),
        userProgress: progress || null,
        completed: progress?.status === 'completed'
      };
    });
    
    res.json({
      success: true,
      challenges: challengesWithProgress
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get daily challenge
// @route   GET /api/challenges/daily
// @access  Private
const getDailyChallenge = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyChallenge = await Challenge.findOne({
      dailyChallenge: true,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    // If no daily challenge for today, create one
    if (!dailyChallenge) {
      const allChallenges = await Challenge.find({ active: true });
      if (allChallenges.length > 0) {
        const randomChallenge = allChallenges[Math.floor(Math.random() * allChallenges.length)];
        dailyChallenge = await Challenge.create({
          ...randomChallenge.toObject(),
          _id: new mongoose.Types.ObjectId(),
          dailyChallenge: true,
          date: today
        });
      }
    }
    
    if (!dailyChallenge) {
      return res.status(404).json({
        success: false,
        message: 'No challenges available'
      });
    }
    
    // Check if user completed today's challenge
    const userChallenge = await UserChallenge.findOne({
      user: req.user._id,
      challenge: dailyChallenge._id
    });
    
    res.json({
      success: true,
      challenge: {
        ...dailyChallenge.toObject(),
        completed: userChallenge?.status === 'completed'
      }
    });
  } catch (error) {
    console.error('Get daily challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Start a challenge
// @route   POST /api/challenges/:challengeId/start
// @access  Private
const startChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }
    
    let userChallenge = await UserChallenge.findOne({
      user: req.user._id,
      challenge: challengeId
    });
    
    if (!userChallenge) {
      userChallenge = await UserChallenge.create({
        user: req.user._id,
        challenge: challengeId,
        status: 'in-progress'
      });
    } else if (userChallenge.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Challenge already completed'
      });
    } else if (userChallenge.status === 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Challenge already in progress'
      });
    }
    
    res.json({
      success: true,
      userChallenge
    });
  } catch (error) {
    console.error('Start challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Submit challenge answer
// @route   POST /api/challenges/:challengeId/submit
// @access  Private
const submitChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { response } = req.body;
    
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }
    
    const userChallenge = await UserChallenge.findOne({
      user: req.user._id,
      challenge: challengeId
    });
    
    if (!userChallenge || userChallenge.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Challenge not started'
      });
    }
    
    if (userChallenge.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Challenge already completed'
      });
    }
    
    // Simple evaluation (in production, use AI or manual review)
    let score = 0;
    let feedback = '';
    
    // Basic scoring based on response length and keywords
    if (response && response.length > 50) {
      score += 50;
    }
    
    // Check for key vocabulary
    const keyWords = challenge.prompt.toLowerCase().split(' ');
    const responseLower = response.toLowerCase();
    keyWords.forEach(word => {
      if (word.length > 3 && responseLower.includes(word)) {
        score += 5;
      }
    });
    
    // Cap at 100
    score = Math.min(score, 100);
    
    if (score >= 70) {
      feedback = 'Great job! Your response was well-structured and used good vocabulary.';
      userChallenge.status = 'completed';
      userChallenge.completedAt = new Date();
      
      // Update user stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: {
          challengesCompleted: 1,
          streak: 1
        }
      });
      
      // Update streak
      const user = await User.findById(req.user._id);
      await user.updateStreak();
    } else {
      feedback = 'Good attempt! Try to use more vocabulary and elaborate your response further.';
      userChallenge.attempt += 1;
    }
    
    userChallenge.score = score;
    userChallenge.response = response;
    userChallenge.feedback = feedback;
    
    await userChallenge.save();
    
    res.json({
      success: true,
      score,
      feedback,
      completed: userChallenge.status === 'completed'
    });
  } catch (error) {
    console.error('Submit challenge error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user's challenge progress
// @route   GET /api/challenges/progress
// @access  Private
const getChallengeProgress = async (req, res) => {
  try {
    const userChallenges = await UserChallenge.find({
      user: req.user._id
    })
    .populate('challenge')
    .sort({ createdAt: -1 });
    
    const completed = userChallenges.filter(uc => uc.status === 'completed');
    const inProgress = userChallenges.filter(uc => uc.status === 'in-progress');
    
    const totalPoints = completed.reduce((sum, uc) => sum + uc.score, 0);
    
    res.json({
      success: true,
      stats: {
        totalCompleted: completed.length,
        totalPoints,
        currentStreak: req.user.streak || 0,
        challengesInProgress: inProgress.length
      },
      history: userChallenges
    });
  } catch (error) {
    console.error('Get challenge progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getChallenges,
  getDailyChallenge,
  startChallenge,
  submitChallenge,
  getChallengeProgress
};