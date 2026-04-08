
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { Award, Clock, Target, TrendingUp, CheckCircle, PlayCircle, Loader2, Calendar, Star, Flame, Mic, Video, Phone, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Challenges = () => {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const { initiateCall } = useCall();
  
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalPoints: 0,
    currentStreak: 0,
    totalMinutes: 0
  });
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callPartner, setCallPartner] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [progressUpdate, setProgressUpdate] = useState({ show: false, challengeId: null, progress: 0 });

  const API_URL = 'http://localhost:5000';

  // Fetch challenges and progress
  const fetchChallenges = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/challenges`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setChallenges(data.challenges);
        // Set daily challenge (first incomplete challenge of the day)
        const incomplete = data.challenges.find(c => c.userProgress?.status !== 'completed');
        if (incomplete) setDailyChallenge(incomplete);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  }, [token]);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/challenges/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  }, [token]);

  useEffect(() => {
    Promise.all([fetchChallenges(), fetchProgress()]).finally(() => setLoading(false));
  }, [fetchChallenges, fetchProgress]);

  // Socket listeners for call matching
  useEffect(() => {
    if (!socket) return;

    const handleCallMatchFound = (data) => {
      toast.dismiss('call-queue');
      toast.success(`Matched with ${data.partnerName}! Starting challenge...`);
      setCallPartner(data);
      // Start the call for challenge
      initiateCall(data.partnerId, 'video', data.partnerName, data.partnerAvatar);
      setShowCallModal(false);
    };

    socket.on('call_match_found', handleCallMatchFound);
    socket.on('waiting_for_partner', ({ type }) => {
      if (type === 'call') {
        toast.loading('Looking for a practice partner...', { id: 'call-queue' });
      }
    });

    return () => {
      socket.off('call_match_found', handleCallMatchFound);
      socket.off('waiting_for_partner');
    };
  }, [socket, initiateCall]);

  // Start a challenge
  const handleStartChallenge = async (challengeId) => {
    try {
      const response = await fetch(`${API_URL}/api/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Challenge started! Find a partner to practice with.');
        setSelectedChallenge(challenges.find(c => c.id === challengeId));
        setShowCallModal(true);
        await fetchChallenges();
      }
    } catch (error) {
      toast.error('Failed to start challenge');
    }
  };

  // Update challenge progress
  const handleUpdateProgress = async (challengeId, currentProgress) => {
    try {
      const response = await fetch(`${API_URL}/api/challenges/${challengeId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentProgress })
      });
      const data = await response.json();
      if (data.success) {
        if (data.completed) {
          toast.success(`🎉 Challenge completed! You earned ${data.pointsEarned} points!`);
          await fetchProgress();
        } else {
          toast.success('Progress updated! Keep going!');
        }
        await fetchChallenges();
        setProgressUpdate({ show: false, challengeId: null, progress: 0 });
      }
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  // Find practice partner
  const findPracticePartner = () => {
    if (!socket) {
      toast.error('Connecting to server...');
      return;
    }
    
    toast.loading('Finding a practice partner...', { id: 'call-queue' });
    socket.emit('join_call_queue', {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar
    });
  };

  // Cancel finding partner
  const cancelFindPartner = () => {
    if (socket) {
      socket.emit('cancel_queue', { userId: user.id, type: 'call' });
      toast.dismiss('call-queue');
      toast('Cancelled');
    }
    setShowCallModal(false);
    setSelectedChallenge(null);
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get progress percentage
  const getProgressPercentage = (challenge) => {
    if (!challenge.userProgress) return 0;
    const progress = challenge.userProgress.current_progress || 0;
    const target = challenge.target_value;
    return Math.min((progress / target) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Speaking Challenges
          </h1>
          <p className="text-gray-600">Complete challenges to improve your English and earn rewards!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalCompleted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Points</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.totalPoints}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Current Streak</p>
                <p className="text-2xl font-bold text-orange-600">{stats.currentStreak} days</p>
              </div>
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-md hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Minutes</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalMinutes}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Daily Challenge Banner */}
        {dailyChallenge && dailyChallenge.userProgress?.status !== 'completed' && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 mb-8 text-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                  {dailyChallenge.icon || '🎯'}
                </div>
                <div>
                  <p className="text-sm opacity-90">Daily Challenge</p>
                  <h2 className="text-2xl font-bold">{dailyChallenge.title}</h2>
                  <p className="text-sm opacity-90">{dailyChallenge.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-sm opacity-90">Reward</p>
                  <p className="text-xl font-bold">{dailyChallenge.points} pts</p>
                </div>
                <button
                  onClick={() => handleStartChallenge(dailyChallenge.id)}
                  className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition flex items-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Start Challenge
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Challenges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {challenges.map((challenge) => {
            const progress = challenge.userProgress?.current_progress || 0;
            const target = challenge.target_value;
            const isCompleted = challenge.userProgress?.status === 'completed';
            const isInProgress = challenge.userProgress?.status === 'in_progress';
            const progressPercent = getProgressPercentage(challenge);

            return (
              <div key={challenge.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                {/* Challenge Header */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-4xl">{challenge.icon || '🎙️'}</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-2">{challenge.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{challenge.description}</p>

                  {/* Challenge Stats */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Target className="w-4 h-4" />
                        <span>Target</span>
                      </div>
                      <span className="font-semibold text-gray-800">
                        {target} {challenge.unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Award className="w-4 h-4" />
                        <span>Reward</span>
                      </div>
                      <span className="font-semibold text-yellow-600">
                        {challenge.points} points
                      </span>
                    </div>

                    {isInProgress && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <TrendingUp className="w-4 h-4" />
                          <span>Progress</span>
                        </div>
                        <span className="font-semibold text-blue-600">
                          {progress} / {target} {challenge.unit}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {isInProgress && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {Math.round(progressPercent)}% complete
                      </p>
                    </div>
                  )}

                  {/* Tip */}
                  {challenge.tip && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800">
                        💡 <span className="font-semibold">Tip:</span> {challenge.tip}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  {!isCompleted ? (
                    !isInProgress ? (
                      <button
                        onClick={() => handleStartChallenge(challenge.id)}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-5 h-5" />
                        Start Challenge
                      </button>
                    ) : (
                      <button
                        onClick={() => setProgressUpdate({ show: true, challengeId: challenge.id, progress })}
                        className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-2 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-teal-600 transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <TrendingUp className="w-5 h-5" />
                        Update Progress
                      </button>
                    )
                  ) : (
                    <div className="w-full bg-gradient-to-r from-green-100 to-teal-100 text-green-700 py-2 px-4 rounded-lg font-semibold text-center flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Completed! +{challenge.points} pts
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Call Modal for Challenge Practice */}
        {showCallModal && selectedChallenge && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Practice Challenge</h2>
                <button onClick={cancelFindPartner} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">{selectedChallenge.icon || '🎙️'}</div>
                <h3 className="text-xl font-bold mb-2">{selectedChallenge.title}</h3>
                <p className="text-gray-600 mb-4">{selectedChallenge.description}</p>
                <div className="bg-purple-100 rounded-lg p-3 mb-4">
                  <p className="text-purple-800 font-semibold">Goal: {selectedChallenge.target_value} {selectedChallenge.unit}</p>
                  <p className="text-purple-600 text-sm">Reward: {selectedChallenge.points} points</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={findPracticePartner}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  Find Practice Partner
                </button>
                <button
                  onClick={cancelFindPartner}
                  className="w-full bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Update Modal */}
        {progressUpdate.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Update Progress</h2>
              <p className="text-gray-600 mb-4">How many minutes have you practiced?</p>
              <input
                type="number"
                value={progressUpdate.progress}
                onChange={(e) => setProgressUpdate({ ...progressUpdate, progress: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter minutes"
                min="0"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleUpdateProgress(progressUpdate.challengeId, progressUpdate.progress)}
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Update
                </button>
                <button
                  onClick={() => setProgressUpdate({ show: false, challengeId: null, progress: 0 })}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Challenges;
