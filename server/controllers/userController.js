const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get all users
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password')
      .sort({ isOnline: -1, fullName: 1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get online users
// @route   GET /api/users/online
// @access  Private
const getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = await User.find({ 
      _id: { $ne: req.user._id },
      isOnline: true 
    }).select('-password');

    res.json({
      success: true,
      count: onlineUsers.length,
      users: onlineUsers
    });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('currentCallId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { fullName, mobileNumber, gender, state, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (fullName) user.fullName = fullName;
    if (mobileNumber) user.mobileNumber = mobileNumber;
    if (gender) user.gender = gender;
    if (state) user.state = state;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        gender: user.gender,
        state: user.state,
        avatar: user.avatar,
        isPremium: user.isPremium,
        streak: user.streak
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user streak
// @route   PUT /api/users/streak
// @access  Private
const updateStreak = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const newStreak = await user.updateStreak();
    
    res.json({
      success: true,
      streak: newStreak
    });
  } catch (error) {
    console.error('Update streak error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user statistics
// @route   PUT /api/users/stats
// @access  Private
const updateStats = async (req, res) => {
  try {
    const { callDuration, messagesSent } = req.body;
    
    const updateData = {};
    if (callDuration) {
      updateData.totalMinutes = req.user.totalMinutes + callDuration;
      updateData.totalCalls = req.user.totalCalls + 1;
    }
    if (messagesSent) {
      updateData.totalMessages = req.user.totalMessages + messagesSent;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: updateData },
      { new: true }
    ).select('-password');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getUsers,
  getOnlineUsers,
  getUserById,
  updateProfile,
  updateStreak,
  updateStats
};