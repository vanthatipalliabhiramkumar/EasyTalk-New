import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import { FaPaperPlane, FaArrowLeft, FaUser, FaTimes } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

const ChatWindow = () => {
  const { userId } = useParams();
  const { user, token } = useAuth();
  const { socket, onlineUsers, isConnected } = useSocket();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Configure axios with auth token
  const api = axios.create({
    baseURL: 'http://localhost:5000',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  useEffect(() => {
    fetchPartner();
    setMessages([]);
    setChatEnded(false);
  }, [userId]);

  // Monitor socket connection status
  useEffect(() => {
    if (!isConnected && !chatEnded) {
      console.log('Socket disconnected - redirecting to home');
      toast.error('Connection lost. Redirecting to home...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    }
  }, [isConnected, navigate, chatEnded]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('new_message', (data) => {
      if (chatEnded) return;
      console.log('New message received:', data);
      if (data.senderId === userId) {
        const newMsg = {
          id: data.id,
          content: data.message,
          sender: data.senderId,
          receiver: user.id,
          createdAt: data.timestamp,
          senderDetails: {
            id: data.senderId,
            name: data.senderName,
            avatar: data.senderAvatar
          }
        };
        setMessages(prev => [...prev, newMsg]);
        scrollToBottom();
      }
    });

    // Listen for typing indicators
    socket.on('user_typing', (data) => {
      if (chatEnded) return;
      if (data.userId === userId) {
        setPartnerTyping(true);
      }
    });

    socket.on('user_stop_typing', (data) => {
      if (chatEnded) return;
      if (data.userId === userId) {
        setPartnerTyping(false);
      }
    });

    // Listen for chat ended by partner
    socket.on('chat_ended', (data) => {
      console.log('Chat ended by partner:', data);
      if (chatEnded) return;
      setChatEnded(true);
      toast.info(`${data.endedByName} has ended the chat. Redirecting to home...`);
      // Clear messages and navigate home
      setMessages([]);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    });

    // Listen for partner disconnected
    socket.on('partner_disconnected', (data) => {
      console.log('Partner disconnected:', data);
      if (chatEnded) return;
      setChatEnded(true);
      toast.error(`${data.partnerName} has disconnected. Redirecting to home...`);
      setMessages([]);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    });

    return () => {
      socket.off('new_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('chat_ended');
      socket.off('partner_disconnected');
    };
  }, [socket, userId, user, navigate, chatEnded]);

  // Check if partner is still online
  useEffect(() => {
    const checkPartnerOnline = () => {
      const isPartnerOnline = onlineUsers.some(u => u.userId === partner?.id);
      if (partner && !isPartnerOnline && !loading && !chatEnded) {
        console.log('Partner went offline');
        setChatEnded(true);
        toast.error(`${partner.name} went offline. Redirecting to home...`);
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    };

    checkPartnerOnline();
  }, [onlineUsers, partner, navigate, loading, chatEnded]);

  const fetchPartner = async () => {
    try {
      const response = await api.get(`/api/users/${userId}`);
      console.log('Partner fetched:', response.data.user);
      setPartner(response.data.user);
    } catch (error) {
      console.error('Fetch partner error:', error);
      setPartner({
        id: userId,
        name: 'English Learner',
        avatar: 'https://ui-avatars.com/api/?name=Partner&background=10B981&color=fff&size=100'
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || chatEnded) return;

    const messageData = {
      receiverId: userId,
      content: newMessage,
      type: 'text'
    };

    try {
      const response = await api.post('/api/chat/send', messageData);
      const savedMessage = response.data.message;
      
      if (socket && !chatEnded) {
        socket.emit('send_message', {
          message: newMessage,
          receiverId: userId,
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          timestamp: new Date().toISOString()
        });
      }
      
      setMessages(prev => [...prev, savedMessage]);
      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Send message error:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      } else {
        toast.error('Failed to send message');
      }
    }
  };

  const handleTyping = () => {
    if (!socket || chatEnded) return;
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', {
        receiverId: userId,
        senderId: user.id,
        senderName: user.name
      });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', {
        receiverId: userId,
        senderId: user.id
      });
    }, 1000);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleEndChat = () => {
    if (chatEnded) return;
    
    if (window.confirm('Are you sure you want to end this chat?')) {
      setChatEnded(true);
      
      // Notify partner that chat is ending
      if (socket && partner) {
        socket.emit('end_chat', {
          chatId: userId,
          userId: user.id,
          userName: user.name,
          partnerId: partner.id
        });
      }
      
      // Clear messages
      setMessages([]);
      toast.success('Chat ended');
      
      // Navigate back to home page after a short delay
      setTimeout(() => {
        navigate('/');
      }, 500);
    }
  };

  const isUserOnline = onlineUsers.some(u => u.userId === partner?.id);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Fixed Header - Profile stays at top */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            <FaArrowLeft />
          </button>
          {partner?.avatar ? (
            <img src={partner.avatar} alt={partner.name} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {partner?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <h2 className="font-semibold text-gray-800">{partner?.name || 'Partner'}</h2>
            <p className="text-xs">
              {isUserOnline && !chatEnded ? (
                <span className="text-green-500 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                  Online
                </span>
              ) : (
                <span className="text-gray-500">Offline</span>
              )}
            </p>
          </div>
        </div>
        
        {/* End Chat Button */}
        <button
          onClick={handleEndChat}
          disabled={chatEnded}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            chatEnded 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-red-500 hover:bg-red-600'
          } text-white`}
        >
          <FaTimes />
          <span>End Chat</span>
        </button>
      </div>

      {/* Scrollable Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ overflowY: 'auto' }}
      >
        {chatEnded ? (
          <div className="text-center text-gray-500 mt-20">
            <FaUser className="text-6xl mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-semibold">Chat Ended</p>
            <p className="text-sm">Redirecting to home page...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <FaUser className="text-6xl mx-auto mb-4 text-gray-300" />
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation with {partner?.name}</p>
            {isUserOnline && (
              <p className="text-xs text-green-500 mt-2">✨ {partner?.name} is online!</p>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${message.sender === user?.id ? 'order-2' : 'order-1'}`}>
                <div
                  className={`rounded-lg px-4 py-2 ${
                    message.sender === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  <p className="break-words">{message.content}</p>
                </div>
                <div
                  className={`flex items-center space-x-1 mt-1 text-xs text-gray-500 ${
                    message.sender === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
        
        {partnerTyping && !chatEnded && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{partner?.name} is typing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Bar at Bottom */}
      <form onSubmit={sendMessage} className="bg-white p-4 border-t flex-shrink-0">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyUp={handleTyping}
            placeholder={isUserOnline && !chatEnded ? "Type a message..." : "Chat ended"}
            disabled={!isUserOnline || chatEnded}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isUserOnline || chatEnded}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPaperPlane />
          </button>
        </div>
        {!isUserOnline && !chatEnded && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            {partner?.name} is offline. Messages will be delivered when they come online.
          </p>
        )}
        {chatEnded && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            This chat has ended. Redirecting to home page...
          </p>
        )}
      </form>
    </div>
  );
};

export default ChatWindow;