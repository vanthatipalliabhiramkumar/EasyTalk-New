import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import Sidebar from '../components/layout/Sidebar';
import { FaPhone, FaComments, FaTrophy, FaClock, FaFire, FaCalendar, FaChartLine } from 'react-icons/fa';
import LoadingSpinner from '../components/common/LoadingSpinner';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const Dashboard = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalMinutes: 0,
    totalMessages: 0,
    totalChallenges: 0,
    currentStreak: 0,
    longestStreak: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [challengeProgress, setChallengeProgress] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch challenge progress
      const challengeResponse = await axios.get('/api/challenges/progress', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch recent chats
      const chatResponse = await axios.get('/api/chat/recent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update stats from user data
      setStats({
        totalCalls: user?.totalCalls || 0,
        totalMinutes: user?.totalMinutes || 0,
        totalMessages: user?.totalMessages || 0,
        totalChallenges: challengeResponse.data.stats?.totalCompleted || 0,
        currentStreak: challengeResponse.data.stats?.currentStreak || user?.streak || 0,
        longestStreak: challengeResponse.data.stats?.currentStreak || 0
      });
      
      setRecentActivity(chatResponse.data.chats || []);
      
    } catch (error) {
      console.error('Fetch dashboard error:', error);
      // Set default stats from user data
      setStats({
        totalCalls: user?.totalCalls || 0,
        totalMinutes: user?.totalMinutes || 0,
        totalMessages: user?.totalMessages || 0,
        totalChallenges: user?.challengesCompleted || 0,
        currentStreak: user?.streak || 0,
        longestStreak: user?.streak || 0
      });
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  // Chart data for weekly progress
  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Speaking Minutes',
        data: [45, 60, 35, 80, 55, 70, 90],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Messages Sent',
        data: [25, 40, 30, 55, 45, 65, 70],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  // Chart data for activity breakdown
  const activityData = {
    labels: ['Voice Calls', 'Video Calls', 'Text Chats'],
    datasets: [
      {
        data: [
          Math.floor((stats.totalCalls || 0) * 0.6),
          Math.floor((stats.totalCalls || 0) * 0.4),
          stats.totalMessages || 0
        ],
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#9ca3af'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#e5e7eb'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            size: 12
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Your Dashboard</h1>
            <p className="text-gray-600 mt-2">Track your English learning progress</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Calls</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalCalls}</p>
                </div>
                <FaPhone className="text-blue-500 text-3xl opacity-50" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Speaking Minutes</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalMinutes}</p>
                </div>
                <FaClock className="text-green-500 text-3xl opacity-50" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Messages Sent</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalMessages}</p>
                </div>
                <FaComments className="text-blue-500 text-3xl opacity-50" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Challenges Done</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalChallenges}</p>
                </div>
                <FaTrophy className="text-yellow-500 text-3xl opacity-50" />
              </div>
            </div>
          </div>

          {/* Streak Card */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-md p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Current Streak</p>
                <p className="text-4xl font-bold">{stats.currentStreak} days</p>
                <p className="text-orange-100 text-sm mt-2">Keep practicing daily!</p>
              </div>
              <div className="text-center">
                <FaFire className="text-5xl text-orange-200" />
                <p className="text-sm mt-2">Best: {stats.longestStreak} days</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaChartLine className="mr-2 text-blue-500" />
                Weekly Progress
              </h3>
              <div className="h-80">
                <Line data={weeklyData} options={chartOptions} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaComments className="mr-2 text-green-500" />
                Activity Breakdown
              </h3>
              <div className="h-80 flex items-center justify-center">
                <div className="w-64 h-64">
                  <Doughnut data={activityData} options={doughnutOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaCalendar className="mr-2 text-purple-500" />
              Recent Conversations
            </h3>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 5).map((chat, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center space-x-3">
                      {chat.avatar ? (
                        <img src={chat.avatar} alt={chat.fullName} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                          {chat.fullName?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800">{chat.fullName || chat.name}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {chat.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FaComments className="text-4xl text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No recent conversations</p>
                  <p className="text-sm text-gray-400 mt-1">Start chatting with partners!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;