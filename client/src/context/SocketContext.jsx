import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🔌 Creating socket connection for user:', user.name, 'ID:', user.id);

    //const socketUrl = 'http://localhost:5000';
    const socketUrl = import.meta.env.VITE_API_URL;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected! Socket ID:', newSocket.id);
      setIsConnected(true);
      
      newSocket.emit('user_connected', {
        userId: user._id,
        userName: user.name,
        userAvatar: user.avatar
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('online_users', (users) => {
      console.log('📡 Online users updated:', users.length);
      setOnlineUsers(users);
    });

    // Add these event listeners only when socket exists
    newSocket.on('user_disconnected', (data) => {
      console.log('User disconnected:', data);
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    newSocket.on('partner_disconnected', (data) => {
      console.log('Partner disconnected:', data);
    });

    setSocket(newSocket);

    return () => {
      console.log('🧹 Cleaning up socket connection');
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
