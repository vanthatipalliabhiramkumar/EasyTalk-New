const Message = require('../models/Message');
const User = require('../models/User');

const chatHandlers = (io, socket) => {
  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, content, type, mediaUrl } = data;
      
      // Create message in database
      const message = await Message.create({
        sender: socket.user._id,
        receiver: receiverId,
        content,
        type: type || 'text',
        mediaUrl: mediaUrl || null,
        delivered: false
      });
      
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'fullName email avatar')
        .populate('receiver', 'fullName email avatar');
      
      // Get receiver's socket ID
      const receiver = await User.findById(receiverId);
      
      // Emit to sender
      socket.emit('message_sent', populatedMessage);
      
      // Emit to receiver if online
      if (receiver && receiver.isOnline && receiver.socketId) {
        io.to(receiver.socketId).emit('new_message', populatedMessage);
        
        // Mark as delivered
        await Message.findByIdAndUpdate(message._id, {
          delivered: true,
          deliveredAt: new Date()
        });
      }
      
      // Update user stats
      await User.findByIdAndUpdate(socket.user._id, {
        $inc: { totalMessages: 1 }
      });
      
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });
  
  // Typing indicator
  socket.on('typing_start', async (data) => {
    try {
      const { receiverId } = data;
      const receiver = await User.findById(receiverId);
      
      if (receiver && receiver.isOnline && receiver.socketId) {
        io.to(receiver.socketId).emit('user_typing', {
          userId: socket.user._id,
          fullName: socket.user.fullName
        });
      }
    } catch (error) {
      console.error('Typing start error:', error);
    }
  });
  
  // Stop typing
  socket.on('typing_stop', async (data) => {
    try {
      const { receiverId } = data;
      const receiver = await User.findById(receiverId);
      
      if (receiver && receiver.isOnline && receiver.socketId) {
        io.to(receiver.socketId).emit('user_stop_typing', {
          userId: socket.user._id
        });
      }
    } catch (error) {
      console.error('Typing stop error:', error);
    }
  });
  
  // Mark messages as read
  socket.on('mark_read', async (data) => {
    try {
      const { senderId } = data;
      
      await Message.updateMany(
        {
          sender: senderId,
          receiver: socket.user._id,
          read: false
        },
        {
          read: true,
          readAt: new Date()
        }
      );
      
      // Notify sender
      const sender = await User.findById(senderId);
      if (sender && sender.isOnline && sender.socketId) {
        io.to(sender.socketId).emit('messages_read', {
          userId: socket.user._id
        });
      }
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });
};

module.exports = chatHandlers;