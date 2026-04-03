import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { FaSpinner, FaTimes, FaUserFriends, FaComments, FaPhone } from 'react-icons/fa';
import toast from 'react-hot-toast';

const WaitingScreen = () => {
  const { type } = useParams(); // 'chat' or 'call'
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [searching, setSearching] = useState(true);
  const [partner, setPartner] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    console.log('WaitingScreen mounted. Type:', type);
    console.log('Socket status:', { socket: !!socket, isConnected, user: !!user });

    if (!socket || !isConnected) {
      console.log('Waiting for socket connection...');
      return;
    }

    if (!user) {
      console.log('Waiting for user data...');
      return;
    }

    console.log(`🎯 Joining ${type} queue with user:`, { id: user.id, name: user.name });

    // Join the appropriate queue
    const queueEvent = type === 'chat' ? 'join_chat_queue' : 'join_call_queue';
    const matchEvent = type === 'chat' ? 'chat_match_found' : 'call_match_found';
    
    // Send join request
    socket.emit(queueEvent, {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar
    });

    // Listen for match found
    const handleMatchFound = (data) => {
      console.log('🎉 MATCH FOUND! Full data:', data);
      setSearching(false);
      setPartner({
        id: data.partnerId,
        name: data.partnerName,
        avatar: data.partnerAvatar
      });
      
      toast.success(`🎉 Matched with ${data.partnerName}!`);
      
      // Navigate after short delay
      setTimeout(() => {
        if (type === 'chat') {
          console.log('Navigating to chat with:', data.partnerId);
          navigate(`/chat/${data.partnerId}`);
        } else if (type === 'call') {
          console.log('Navigating to call with:', data.partnerId);
          navigate(`/call/${data.partnerId}`);
        }
      }, 2000);
    };

    // Listen for waiting status
    const handleWaiting = (data) => {
      console.log('⏳ Waiting for partner:', data);
    };

    socket.on(matchEvent, handleMatchFound);
    socket.on('waiting_for_partner', handleWaiting);

    // Timer for elapsed time
    const timer = setInterval(() => {
      setTimeElapsed(prev => {
        if (prev >= 60) {
          clearInterval(timer);
          toast.error('No partners found. Please try again.');
          navigate('/');
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      console.log('🧹 Cleaning up waiting screen...');
      socket.off(matchEvent, handleMatchFound);
      socket.off('waiting_for_partner', handleWaiting);
      clearInterval(timer);
      
      if (searching && socket) {
        console.log('Cancelling queue for user:', user.id);
        socket.emit('cancel_queue', { userId: user.id, type });
      }
    };
  }, [socket, isConnected, type, navigate, user]);

  const handleCancel = () => {
    if (socket) {
      socket.emit('cancel_queue', { userId: user.id, type });
    }
    navigate('/');
  };

  const getIcon = () => {
    if (type === 'chat') return <FaComments className="text-blue-600 text-5xl animate-bounce" />;
    if (type === 'call') return <FaPhone className="text-green-600 text-5xl animate-bounce" />;
    return <FaUserFriends className="text-blue-600 text-5xl animate-bounce" />;
  };

  const getTitle = () => {
    if (type === 'chat') return 'Chat Partner';
    if (type === 'call') return 'Call Partner';
    return 'Speaking Partner';
  };

  const getMessage = () => {
    if (!isConnected) return "Connecting to server...";
    if (timeElapsed < 10) return `Finding your ${getTitle()}...`;
    if (timeElapsed < 30) return `Still looking... There are many learners online`;
    if (timeElapsed < 50) return "Almost there! Matching you with someone...";
    return "Taking longer than usual. Please wait...";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        {searching ? (
          <>
            <div className="mb-8 relative">
              <div className="w-32 h-32 mx-auto relative">
                <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-blue-100 rounded-full w-32 h-32 flex items-center justify-center">
                  {getIcon()}
                </div>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {getMessage()}
            </h2>
            <p className="text-gray-600 mb-4">
              Looking for a {type === 'chat' ? 'chat' : 'call'} partner
            </p>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((timeElapsed / 60) * 100, 100)}%` }}
              ></div>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
            </p>
            
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-2 mx-auto"
            >
              <FaTimes />
              <span>Cancel Search</span>
            </button>
            
            <p className="text-xs text-gray-400 mt-6">
              💡 Tip: Open another browser window with a different account to test matching
            </p>
            {!isConnected && (
              <p className="text-xs text-red-500 mt-2">
                ⚠️ Connecting to server... Please wait
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-8">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <FaSpinner className="text-green-600 text-4xl animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Partner Found!
            </h2>
            <p className="text-gray-600">
              Connecting you with {partner?.name}...
            </p>
            <div className="mt-4 flex items-center justify-center space-x-2">
              {partner?.avatar ? (
                <img src={partner.avatar} alt={partner.name} className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl">
                  {partner?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="text-left">
                <p className="font-semibold">{partner?.name}</p>
                <p className="text-sm text-green-500">Now connecting...</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WaitingScreen;