const Call = require('../models/Call');
const User = require('../models/User');

const callHandlers = (io, socket) => {
  // Initiate call
  socket.on('initiate_call', async (data) => {
    try {
      const { receiverId, callType } = data;
      
      // Check if receiver is online
      const receiver = await User.findById(receiverId);
      
      if (!receiver || !receiver.isOnline) {
        socket.emit('call_error', { error: 'User is offline' });
        return;
      }
      
      if (receiver.inCall) {
        socket.emit('call_error', { error: 'User is already in a call' });
        return;
      }
      
      // Create call record
      const call = await Call.create({
        caller: socket.user._id,
        receiver: receiverId,
        type: callType,
        status: 'initiated'
      });
      
      // Update user inCall status
      await User.findByIdAndUpdate(socket.user._id, {
        inCall: true,
        currentCallId: call._id
      });
      
      await User.findByIdAndUpdate(receiverId, {
        inCall: true,
        currentCallId: call._id
      });
      
      // Send call request to receiver
      io.to(receiver.socketId).emit('incoming_call', {
        callId: call._id,
        caller: {
          _id: socket.user._id,
          fullName: socket.user.fullName,
          avatar: socket.user.avatar
        },
        callType
      });
      
      socket.emit('call_initiated', {
        callId: call._id,
        receiver: {
          _id: receiver._id,
          fullName: receiver.fullName,
          avatar: receiver.avatar
        }
      });
      
    } catch (error) {
      console.error('Initiate call error:', error);
      socket.emit('call_error', { error: 'Failed to initiate call' });
    }
  });
  
  // Accept call
  socket.on('accept_call', async (data) => {
    try {
      const { callId } = data;
      
      const call = await Call.findById(callId)
        .populate('caller', 'fullName avatar')
        .populate('receiver', 'fullName avatar');
      
      if (!call) {
        socket.emit('call_error', { error: 'Call not found' });
        return;
      }
      
      call.status = 'accepted';
      call.startedAt = new Date();
      await call.save();
      
      // Get caller's socket
      const caller = await User.findById(call.caller._id);
      
      if (caller && caller.socketId) {
        io.to(caller.socketId).emit('call_accepted', {
          callId: call._id,
          callType: call.type
        });
      }
      
      socket.emit('call_connected', {
        callId: call._id,
        callType: call.type
      });
      
    } catch (error) {
      console.error('Accept call error:', error);
      socket.emit('call_error', { error: 'Failed to accept call' });
    }
  });
  
  // Reject call
  socket.on('reject_call', async (data) => {
    try {
      const { callId } = data;
      
      const call = await Call.findById(callId);
      
      if (!call) {
        socket.emit('call_error', { error: 'Call not found' });
        return;
      }
      
      call.status = 'rejected';
      call.endedAt = new Date();
      await call.save();
      
      // Get caller's socket
      const caller = await User.findById(call.caller);
      
      if (caller && caller.socketId) {
        io.to(caller.socketId).emit('call_rejected', {
          callId: call._id
        });
      }
      
      // Reset user inCall status
      await User.findByIdAndUpdate(call.caller, {
        inCall: false,
        currentCallId: null
      });
      
      await User.findByIdAndUpdate(call.receiver, {
        inCall: false,
        currentCallId: null
      });
      
      socket.emit('call_rejected_confirmation', {
        callId: call._id
      });
      
    } catch (error) {
      console.error('Reject call error:', error);
      socket.emit('call_error', { error: 'Failed to reject call' });
    }
  });
  
  // End call
  socket.on('end_call', async (data) => {
    try {
      const { callId } = data;
      
      const call = await Call.findById(callId);
      
      if (!call) {
        socket.emit('call_error', { error: 'Call not found' });
        return;
      }
      
      call.status = 'ended';
      call.endedAt = new Date();
      await call.save();
      
      // Get participants
      const caller = await User.findById(call.caller);
      const receiver = await User.findById(call.receiver);
      
      // Notify both participants
      if (caller && caller.socketId) {
        io.to(caller.socketId).emit('call_ended', {
          callId: call._id,
          duration: call.duration
        });
      }
      
      if (receiver && receiver.socketId) {
        io.to(receiver.socketId).emit('call_ended', {
          callId: call._id,
          duration: call.duration
        });
      }
      
      // Reset user inCall status
      await User.findByIdAndUpdate(call.caller, {
        inCall: false,
        currentCallId: null,
        $inc: {
          totalCalls: 1,
          totalMinutes: call.duration
        }
      });
      
      await User.findByIdAndUpdate(call.receiver, {
        inCall: false,
        currentCallId: null,
        $inc: {
          totalCalls: 1,
          totalMinutes: call.duration
        }
      });
      
    } catch (error) {
      console.error('End call error:', error);
      socket.emit('call_error', { error: 'Failed to end call' });
    }
  });
  
  // WebRTC signaling
  socket.on('webrtc_offer', async (data) => {
    try {
      const { targetUserId, offer } = data;
      const targetUser = await User.findById(targetUserId);
      
      if (targetUser && targetUser.socketId) {
        io.to(targetUser.socketId).emit('webrtc_offer', {
          from: socket.user._id,
          offer
        });
      }
    } catch (error) {
      console.error('WebRTC offer error:', error);
    }
  });
  
  socket.on('webrtc_answer', async (data) => {
    try {
      const { targetUserId, answer } = data;
      const targetUser = await User.findById(targetUserId);
      
      if (targetUser && targetUser.socketId) {
        io.to(targetUser.socketId).emit('webrtc_answer', {
          from: socket.user._id,
          answer
        });
      }
    } catch (error) {
      console.error('WebRTC answer error:', error);
    }
  });
  
  socket.on('webrtc_ice_candidate', async (data) => {
    try {
      const { targetUserId, candidate } = data;
      const targetUser = await User.findById(targetUserId);
      
      if (targetUser && targetUser.socketId) {
        io.to(targetUser.socketId).emit('webrtc_ice_candidate', {
          from: socket.user._id,
          candidate
        });
      }
    } catch (error) {
      console.error('WebRTC ICE candidate error:', error);
    }
  });
};

module.exports = callHandlers;