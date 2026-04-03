const User = require('../models/User');

// Matchmaking queue
let matchQueue = {
  chat: [],
  call: []
};

const matchHandlers = (io, socket) => {
  // Join matchmaking
  socket.on('join_matchmaking', async (data) => {
    try {
      const { type } = data; // 'chat' or 'call'
      
      // Check if already in queue
      const existingIndex = matchQueue[type].findIndex(
        q => q.userId.toString() === socket.user._id.toString()
      );
      
      if (existingIndex !== -1) {
        socket.emit('matchmaking_error', { error: 'Already in queue' });
        return;
      }
      
      // Add to queue
      matchQueue[type].push({
        userId: socket.user._id,
        socketId: socket.id,
        user: socket.user
      });
      
      socket.emit('matchmaking_started', { type });
      
      // Try to find match
      tryMatch(socket, type);
      
    } catch (error) {
      console.error('Join matchmaking error:', error);
      socket.emit('matchmaking_error', { error: 'Failed to join matchmaking' });
    }
  });
  
  // Cancel matchmaking
  socket.on('cancel_matchmaking', async (data) => {
    try {
      const { type } = data;
      
      const index = matchQueue[type].findIndex(
        q => q.userId.toString() === socket.user._id.toString()
      );
      
      if (index !== -1) {
        matchQueue[type].splice(index, 1);
        socket.emit('matchmaking_cancelled', { type });
      }
      
    } catch (error) {
      console.error('Cancel matchmaking error:', error);
    }
  });
  
  // Function to try matching users
  const tryMatch = async (socket, type) => {
    // Wait a bit to allow others to join
    setTimeout(async () => {
      const queue = matchQueue[type];
      const currentIndex = queue.findIndex(
        q => q.userId.toString() === socket.user._id.toString()
      );
      
      if (currentIndex === -1) return;
      
      const currentUser = queue[currentIndex];
      
      // Find another user in queue (not self)
      const matchIndex = queue.findIndex(
        (q, idx) => idx !== currentIndex && q.userId.toString() !== socket.user._id.toString()
      );
      
      if (matchIndex !== -1) {
        const matchedUser = queue[matchIndex];
        
        // Remove both from queue
        queue.splice(currentIndex, 1);
        queue.splice(matchIndex < currentIndex ? matchIndex : matchIndex - 1, 1);
        
        // Notify both users
        io.to(currentUser.socketId).emit('match_found', {
          partner: {
            _id: matchedUser.user._id,
            fullName: matchedUser.user.fullName,
            avatar: matchedUser.user.avatar
          },
          type
        });
        
        io.to(matchedUser.socketId).emit('match_found', {
          partner: {
            _id: currentUser.user._id,
            fullName: currentUser.user.fullName,
            avatar: currentUser.user.avatar
          },
          type
        });
      }
    }, 1000);
  };
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    // Remove from all queues
    Object.keys(matchQueue).forEach(type => {
      const index = matchQueue[type].findIndex(
        q => q.userId.toString() === socket.user._id.toString()
      );
      if (index !== -1) {
        matchQueue[type].splice(index, 1);
      }
    });
  });
};

module.exports = matchHandlers;