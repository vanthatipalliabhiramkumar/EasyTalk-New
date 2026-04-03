const socketIO = require('socket.io');

let io;
let connectedUsers = new Map(); // userId -> socketId
let waitingUsers = []; // Queue for matchmaking

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    // Store user connection
    socket.on('user_connected', (userData) => {
      const { userId, userName, userAvatar } = userData;
      connectedUsers.set(userId, {
        socketId: socket.id,
        userName,
        userAvatar,
        isOnline: true
      });
      
      console.log(`✅ User ${userName} (${userId}) connected`);
      
      // Broadcast online users to all
      const onlineUsersList = Array.from(connectedUsers.entries()).map(([id, data]) => ({
        userId: id,
        userName: data.userName,
        userAvatar: data.userAvatar
      }));
      
      io.emit('online_users', onlineUsersList);
      socket.broadcast.emit('user_joined', { userId, userName, userAvatar });
    });

    // Handle direct messages
    socket.on('send_message', (data) => {
      const { message, receiverId, senderId, senderName, senderAvatar, timestamp } = data;
      
      const receiver = connectedUsers.get(receiverId);
      if (receiver) {
        // Send to receiver
        io.to(receiver.socketId).emit('new_message', {
          message,
          senderId,
          senderName,
          senderAvatar,
          timestamp,
          isOwn: false
        });
        
        // Also send back to sender for confirmation
        socket.emit('message_sent', {
          message,
          receiverId,
          timestamp
        });
        
        console.log(`💬 Message from ${senderName} to ${receiver.userName}`);
      } else {
        console.log(`⚠️ User ${receiverId} not connected`);
        socket.emit('message_error', { error: 'User is offline' });
      }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      const { receiverId, senderId, senderName } = data;
      const receiver = connectedUsers.get(receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit('user_typing', {
          userId: senderId,
          userName: senderName
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { receiverId, senderId } = data;
      const receiver = connectedUsers.get(receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit('user_stop_typing', {
          userId: senderId
        });
      }
    });

    // Matchmaking for chat/call
    socket.on('join_matchmaking', (data) => {
      const { userId, userName, userAvatar, type } = data;
      
      // Remove from waiting queue if already there
      waitingUsers = waitingUsers.filter(u => u.userId !== userId);
      
      // Add to waiting queue
      waitingUsers.push({
        userId,
        userName,
        userAvatar,
        socketId: socket.id,
        type
      });
      
      console.log(`🎯 ${userName} joined matchmaking for ${type}`);
      
      // Try to find a match
      findMatch(userId, type);
    });

    socket.on('cancel_matchmaking', (data) => {
      const { userId } = data;
      waitingUsers = waitingUsers.filter(u => u.userId !== userId);
      console.log(`❌ User ${userId} cancelled matchmaking`);
    });

    // Call signaling
    socket.on('initiate_call', (data) => {
      const { callerId, callerName, callerAvatar, receiverId, callType } = data;
      const receiver = connectedUsers.get(receiverId);
      
      if (receiver) {
        io.to(receiver.socketId).emit('incoming_call', {
          callerId,
          callerName,
          callerAvatar,
          callType,
          callId: Date.now().toString()
        });
        console.log(`📞 Call from ${callerName} to ${receiver.userName}`);
      } else {
        socket.emit('call_error', { error: 'User is offline' });
      }
    });

    socket.on('accept_call', (data) => {
      const { callerId, receiverId, receiverName, callId } = data;
      const caller = connectedUsers.get(callerId);
      
      if (caller) {
        io.to(caller.socketId).emit('call_accepted', {
          receiverId,
          receiverName,
          callId
        });
        console.log(`✅ Call accepted: ${callId}`);
      }
    });

    socket.on('reject_call', (data) => {
      const { callerId, callId } = data;
      const caller = connectedUsers.get(callerId);
      
      if (caller) {
        io.to(caller.socketId).emit('call_rejected', { callId });
        console.log(`❌ Call rejected: ${callId}`);
      }
    });

    socket.on('end_call', (data) => {
      const { callerId, receiverId, callId } = data;
      const caller = connectedUsers.get(callerId);
      const receiver = connectedUsers.get(receiverId);
      
      if (caller) {
        io.to(caller.socketId).emit('call_ended', { callId });
      }
      if (receiver) {
        io.to(receiver.socketId).emit('call_ended', { callId });
      }
      console.log(`🔴 Call ended: ${callId}`);
    });

    // WebRTC signaling
    socket.on('webrtc_offer', (data) => {
      const { targetUserId, offer, callerId } = data;
      const target = connectedUsers.get(targetUserId);
      
      if (target) {
        io.to(target.socketId).emit('webrtc_offer', {
          offer,
          callerId
        });
      }
    });

    socket.on('webrtc_answer', (data) => {
      const { targetUserId, answer, callerId } = data;
      const target = connectedUsers.get(targetUserId);
      
      if (target) {
        io.to(target.socketId).emit('webrtc_answer', {
          answer,
          callerId
        });
      }
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { targetUserId, candidate, callerId } = data;
      const target = connectedUsers.get(targetUserId);
      
      if (target) {
        io.to(target.socketId).emit('webrtc_ice_candidate', {
          candidate,
          callerId
        });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
      
      // Remove from connected users
      let disconnectedUserId = null;
      for (const [userId, data] of connectedUsers.entries()) {
        if (data.socketId === socket.id) {
          disconnectedUserId = userId;
          connectedUsers.delete(userId);
          break;
        }
      }
      
      // Remove from waiting queue
      waitingUsers = waitingUsers.filter(u => u.socketId !== socket.id);
      
      if (disconnectedUserId) {
        console.log(`👋 User ${disconnectedUserId} disconnected`);
        
        // Broadcast updated online users
        const onlineUsersList = Array.from(connectedUsers.entries()).map(([id, data]) => ({
          userId: id,
          userName: data.userName,
          userAvatar: data.userAvatar
        }));
        
        io.emit('online_users', onlineUsersList);
        socket.broadcast.emit('user_left', { userId: disconnectedUserId });
      }
    });
  });
  
  return io;
};

function findMatch(userId, type) {
  // Find another user waiting for same type
  const match = waitingUsers.find(u => u.userId !== userId && u.type === type);
  
  if (match) {
    // Remove both from queue
    waitingUsers = waitingUsers.filter(u => u.userId !== userId && u.userId !== match.userId);
    
    // Notify both users
    const user = waitingUsers.find(u => u.userId === userId);
    
    io.to(match.socketId).emit('match_found', {
      partnerId: userId,
      partnerName: user?.userName,
      partnerAvatar: user?.userAvatar,
      type
    });
    
    io.to(user?.socketId).emit('match_found', {
      partnerId: match.userId,
      partnerName: match.userName,
      partnerAvatar: match.userAvatar,
      type
    });
    
    console.log(`🎉 Match found: ${user?.userName} <-> ${match.userName} for ${type}`);
  }
}

module.exports = { initSocket, getIO: () => io };