import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

// ==================== SOCKET URL CONFIGURATION ====================
// Hardcoded URLs for Render deployment
const PRODUCTION_URL = 'https://easytalk-new.onrender.com';
const DEVELOPMENT_URL = 'http://localhost:5000';

// Determine which URL to use
const getSocketUrl = () => {
  // Check if we're in production (Render)
  if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
    console.log('🔌 Production mode detected, using:', PRODUCTION_URL);
    return PRODUCTION_URL;
  }
  console.log('🔌 Development mode detected, using:', DEVELOPMENT_URL);
  return DEVELOPMENT_URL;
};

const SOCKET_URL = getSocketUrl();

console.log(`🔌 Socket.IO connecting to: ${SOCKET_URL}`);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.log('👤 No user, skipping socket connection');
      return;
    }

    console.log('🔌 Creating socket connection for user:', user.name, 'ID:', user.id);
    console.log('📡 Connecting to socket URL:', SOCKET_URL);

    // Create socket connection with proper configuration for Render
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'], // polling first, then upgrade to websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      withCredentials: true,
      path: '/socket.io/'
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket connected successfully!');
      console.log('📡 Socket ID:', newSocket.id);
      console.log('🌐 Connected to:', SOCKET_URL);
      setIsConnected(true);
      
      // Register user after connection
      newSocket.emit('user_connected', {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
      console.error('❌ Failed to connect to:', SOCKET_URL);
      console.error('🔄 Will retry automatically...');
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      
      // Re-register user after reconnection
      newSocket.emit('user_connected', {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar
      });
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt:', attemptNumber);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('🔄 Reconnection error:', error.message);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
    });

    // Online users event
    newSocket.on('online_users', (users) => {
      console.log('📡 Online users updated:', users?.length || 0);
      setOnlineUsers(users || []);
    });

    // User events
    newSocket.on('user_disconnected', (data) => {
      console.log('👋 User disconnected:', data);
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    newSocket.on('partner_disconnected', (data) => {
      console.log('🔌 Partner disconnected:', data);
    });

    newSocket.on('user_connected_broadcast', (data) => {
      console.log('👤 User connected:', data);
    });

    // Call events
    newSocket.on('call_match_found', (data) => {
      console.log('📞 Call match found:', data);
    });

    newSocket.on('incoming_call', (data) => {
      console.log('📞 Incoming call:', data);
    });

    newSocket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
    });

    newSocket.on('call_rejected', (data) => {
      console.log('❌ Call rejected:', data);
    });

    newSocket.on('call_ended', (data) => {
      console.log('📞 Call ended:', data);
    });

    // Chat events
    newSocket.on('chat_match_found', (data) => {
      console.log('💬 Chat match found:', data);
    });

    newSocket.on('new_message', (data) => {
      console.log('💬 New message:', data);
    });

    newSocket.on('user_typing', (data) => {
      console.log('✏️ User typing:', data);
    });

    newSocket.on('user_stop_typing', (data) => {
      console.log('✏️ User stopped typing:', data);
    });

    newSocket.on('chat_ended', (data) => {
      console.log('🔚 Chat ended:', data);
    });

    // WebRTC events
    newSocket.on('offer', (data) => {
      console.log('📡 WebRTC offer received');
    });

    newSocket.on('answer', (data) => {
      console.log('📡 WebRTC answer received');
    });

    newSocket.on('ice-candidate', (data) => {
      console.log('📡 ICE candidate received');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up socket connection for user:', user.name);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
