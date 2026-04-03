const chatHandlers = require('./chatHandlers');
const callHandlers = require('./callHandlers');
const matchHandlers = require('./matchHandlers');
const User = require('../models/User');

const socketManager = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.fullName} (${socket.id})`);
    
    // Update user status
    User.findByIdAndUpdate(socket.user._id, {
      isOnline: true,
      socketId: socket.id,
      lastSeen: new Date()
    }).then(() => {
      // Broadcast online status to all connected users
      socket.broadcast.emit('user_online', {
        userId: socket.user._id,
        fullName: socket.user.fullName
      });
    });
    
    // Initialize handlers
    chatHandlers(io, socket);
    callHandlers(io, socket);
    matchHandlers(io, socket);
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.fullName}`);
      
      // Update user status
      await User.findByIdAndUpdate(socket.user._id, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: null,
        inCall: false
      });
      
      // Broadcast offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.user._id
      });
    });
  });
};

module.exports = socketManager;