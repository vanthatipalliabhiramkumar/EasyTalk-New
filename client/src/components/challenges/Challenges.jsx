import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
//import axios from 'axios';
import { FaTrophy, FaStar, FaCalendar, FaCheckCircle, FaClock } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import Sidebar from '../layout/Sidebar';
import ChallengeCard from './ChallengeCard';
import api from '../../utils/api';
const Challenges = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('daily');
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    fetchChallenges();
    fetchDailyChallenge();
    fetchProgress();
  }, []);

  const fetchChallenges = async () => {
    try {
      const response = await api.get('/api/challenges');
      setChallenges(response.data.challenges);
    } catch (error) {
      console.error('Fetch challenges error:', error);
      toast.error('Failed to load challenges');
    }
  };

  const fetchDailyChallenge = async () => {
    try {
      const response = await api.get('/api/challenges/daily');
      setDailyChallenge(response.data.challenge);
    } catch (error) {
      console.error('Fetch daily challenge error:', error);
    }
  };

  const fetchProgress = async () => {
    try {
      const response = await api.get('/api/challenges/progress');
      setProgress(response.data.stats);
    } catch (error) {
      console.error('Fetch progress error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChallenge = async (challengeId) => {
    try {
      await api.post(`/api/challenges/${challengeId}/start`);
      toast.success('Challenge started!');
      fetchChallenges();
    } catch (error) {
      console.error('Start challenge error:', error);
      toast.error('Failed to start challenge');
    }
  };

  const submitChallenge = async (challengeId, response) => {
    try {
      const result = await api.post(`/api/challenges/${challengeId}/submit`, { response });
      toast.success(`Score: ${result.data.score} - ${result.data.feedback}`);
      fetchChallenges();
      fetchProgress();
      fetchDailyChallenge();
    } catch (error) {
      console.error('Submit challenge error:', error);
      toast.error('Failed to submit challenge');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
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
            <h1 className="text-3xl font-bold text-gray-800">Speaking Challenges</h1>
            <p className="text-gray-600 mt-2">Improve your English with daily challenges</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Completed</p>
                  <p className="text-2xl font-bold text-gray-800">{progress?.totalCompleted || 0}</p>
                </div>
                <FaCheckCircle className="text-green-500 text-3xl opacity-50" />
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Current Streak</p>
                  <p className="text-2xl font-bold text-gray-800">{progress?.currentStreak || 0}</p>
                </div>
                <FaCalendar className="text-orange-500 text-3xl opacity-50" />
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Points</p>
                  <p className="text-2xl font-bold text-gray-800">{progress?.totalPoints || 0}</p>
                </div>
                <FaStar className="text-yellow-500 text-3xl opacity-50" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'daily'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Daily Challenge
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'all'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  All Challenges
                </button>
              </nav>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'daily' ? (
            dailyChallenge ? (
              <ChallengeCard
                challenge={dailyChallenge}
                isDaily
                onStart={startChallenge}
                onSubmit={submitChallenge}
              />
            ) : (
              <div className="text-center py-12">
                <FaTrophy className="text-6xl mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No daily challenge available</p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map(challenge => (
                <ChallengeCard
                  key={challenge._id}
                  challenge={challenge}
                  onStart={startChallenge}
                  onSubmit={submitChallenge}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Challenges;
