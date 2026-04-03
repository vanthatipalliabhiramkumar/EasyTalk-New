import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { FaComments, FaPhone, FaTrophy, FaChartLine, FaFire, FaSignOutAlt, FaRobot } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

const Home = () => {
  const { user, logout } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalMinutes: 0,
    totalMessages: 0,
    challengesCompleted: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/challenges/progress');
      setStats(prev => ({
        ...prev,
        challengesCompleted: response.data.stats?.totalCompleted || 0
      }));
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const handleFindChatPartner = () => {
    if (!socket || !isConnected) {
      toast.error('Connecting to server... Please wait');
      return;
    }
    navigate('/waiting/chat');
  };

  const handleFindCallPartner = () => {
    if (!socket || !isConnected) {
      toast.error('Connecting to server... Please wait');
      return;
    }
    navigate('/waiting/call');
  };

  const handleAIChat = () => {
    toast.info('AI Teacher feature coming soon! 🚀');
  };

  // Top buttons - Only Chat and Call
  const topButtons = [
    {
      title: 'Chat with Partner',
      description: 'Text chat with other learners',
      icon: FaComments,
      color: 'from-blue-500 to-cyan-500',
      action: handleFindChatPartner,
      buttonText: 'Find Partner →'
    },
    {
      title: 'Talk with Partner',
      description: 'Voice & video calls',
      icon: FaPhone,
      color: 'from-green-500 to-teal-500',
      action: handleFindCallPartner,
      buttonText: 'Start Call →'
    }
  ];

  // Bottom buttons - Other features
  const bottomButtons = [
    {
      title: 'AI Teacher',
      description: 'Coming Soon! Practice with AI tutor',
      icon: FaRobot,
      color: 'from-purple-500 to-pink-500',
      action: handleAIChat,
      buttonText: 'Coming Soon →',
      disabled: true
    },
    {
      title: 'Speaking Challenges',
      description: 'Improve with daily challenges',
      icon: FaTrophy,
      color: 'from-yellow-500 to-orange-500',
      action: () => navigate('/challenges'),
      buttonText: 'View Challenges →'
    },
    {
      title: 'Progress Dashboard',
      description: 'Track your learning journey',
      icon: FaChartLine,
      color: 'from-indigo-500 to-purple-500',
      action: () => navigate('/dashboard'),
      buttonText: 'View Stats →'
    }
  ];

  const displayName = user?.name || user?.fullName || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">EasyTalk</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-green-100 px-3 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm text-green-700">{onlineUsers.length} online</span>
            </div>
            <div className="flex items-center space-x-3">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {userInitial}
                </div>
              )}
              <span className="text-gray-700 font-medium">Hi, {displayName}!</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <FaSignOutAlt />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 mb-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}! 🎉</h1>
              <p className="text-blue-100">Ready to practice your English today?</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-full px-4 py-2 flex items-center space-x-2">
              <FaFire className="text-orange-300" />
              <span className="font-semibold">{user?.streak || 0} day streak</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">Total Calls</p>
                <p className="text-xl font-bold text-gray-800">{user?.totalCalls || 0}</p>
              </div>
              <FaPhone className="text-blue-500 text-2xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">Speaking Min</p>
                <p className="text-xl font-bold text-gray-800">{user?.totalMinutes || 0}</p>
              </div>
              <FaChartLine className="text-green-500 text-2xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">Messages</p>
                <p className="text-xl font-bold text-gray-800">{user?.totalMessages || 0}</p>
              </div>
              <FaComments className="text-blue-500 text-2xl opacity-50" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs">Challenges</p>
                <p className="text-xl font-bold text-gray-800">{stats.challengesCompleted}</p>
              </div>
              <FaTrophy className="text-yellow-500 text-2xl opacity-50" />
            </div>
          </div>
        </div>

        {/* Top Buttons - Chat & Call (2 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {topButtons.map((button, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
              onClick={button.action}
            >
              <div className={`bg-gradient-to-r ${button.color} p-6 text-white`}>
                <button.icon className="text-5xl mb-4" />
                <h3 className="text-2xl font-bold">{button.title}</h3>
                <p className="mt-2 opacity-90 text-lg">{button.description}</p>
              </div>
              <div className="p-6">
                <span className="text-blue-600 font-medium text-lg hover:text-blue-700 transition-colors">
                  {button.buttonText}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom Buttons - Other features (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bottomButtons.map((button, index) => (
            <div 
              key={index} 
              className={`bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 ${
                button.disabled ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-xl cursor-pointer transform hover:-translate-y-1'
              }`}
              onClick={button.disabled ? undefined : button.action}
            >
              <div className={`bg-gradient-to-r ${button.color} p-5 text-white`}>
                <button.icon className="text-4xl mb-3" />
                <h3 className="text-xl font-bold">{button.title}</h3>
                <p className="mt-1 opacity-90 text-sm">{button.description}</p>
              </div>
              <div className="p-5">
                {button.disabled ? (
                  <span className="text-gray-400 font-medium">
                    {button.buttonText}
                  </span>
                ) : (
                  <span className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                    {button.buttonText}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Connection Status */}
        <div className="mt-8 text-center">
          <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>
              {isConnected ? 'Connected to server' : 'Connecting to server...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;