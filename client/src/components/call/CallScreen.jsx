import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CallScreen = () => {
  const { callId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { 
    callStatus, 
    callType, 
    callDuration, 
    localStream, 
    remoteStream, 
    localVideoRef, 
    remoteVideoRef, 
    partnerName: contextPartnerName,
    partnerAvatar: contextPartnerAvatar,
    endCall, 
    toggleMic,
    acceptCall
  } = useCall();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState('');
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Get partner info from URL params or location state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlPartnerId = params.get('partnerId');
    const urlPartnerName = params.get('partnerName');
    const urlPartnerAvatar = params.get('partnerAvatar');
    
    if (urlPartnerName) {
      setPartnerName(decodeURIComponent(urlPartnerName));
      setPartnerAvatar(urlPartnerAvatar || '');
    } else if (contextPartnerName) {
      setPartnerName(contextPartnerName);
    } else {
      setPartnerName('Partner');
    }
  }, [location, contextPartnerName]);

  // Fetch partner details if partnerId is available
  useEffect(() => {
    const fetchPartner = async () => {
      const params = new URLSearchParams(location.search);
      const partnerId = params.get('partnerId');
      
      if (partnerId && partnerId !== 'undefined' && partnerId !== 'null') {
        try {
          console.log('Fetching partner with ID:', partnerId);
          const response = await fetch(`http://localhost:5000/api/users/${partnerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          console.log('Partner API response:', data);
          
          if (data.success && data.user) {
            setPartnerName(data.user.name);
            setPartnerAvatar(data.user.avatar);
          }
        } catch (error) {
          console.error('Error fetching partner:', error);
        }
      }
    };
    
    fetchPartner();
  }, [location, token]);

  useEffect(() => {
    // Simulate connection delay
    const timer = setTimeout(() => {
      setIsConnecting(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (callStatus === 'idle') {
      const timer = setTimeout(() => navigate('/dashboard'), 2000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, navigate]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    endCall();
    toast.success('Call ended');
    navigate('/dashboard');
  };

  const handleToggleMic = () => {
    toggleMic();
    setIsMuted(!isMuted);
    toast(isMuted ? 'Microphone on' : 'Microphone off', { icon: isMuted ? '🎤' : '🔇' });
  };

  const handleToggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
      setIsSpeakerOn(!remoteVideoRef.current.muted);
      toast(remoteVideoRef.current.muted ? 'Speaker off' : 'Speaker on', { icon: '🔊' });
    }
  };

  const getCallStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (callStatus === 'ringing') return 'Ringing...';
    if (callStatus === 'connecting') return 'Connecting...';
    if (callStatus === 'connected') return 'Connected';
    return 'Call ended';
  };

  const getStatusColor = () => {
    if (isConnecting) return 'text-yellow-400';
    if (callStatus === 'ringing') return 'text-yellow-400';
    if (callStatus === 'connecting') return 'text-blue-400';
    if (callStatus === 'connected') return 'text-green-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Main Call Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center w-full max-w-md">
          {/* Animated avatar or profile image */}
          <div className="relative inline-block mb-6">
            <div className={`w-32 h-32 rounded-full mx-auto overflow-hidden border-4 ${
              callStatus === 'connected' ? 'border-green-500' : 'border-purple-500'
            } shadow-lg`}>
              {partnerAvatar ? (
                <img 
                  src={partnerAvatar} 
                  alt={partnerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-4xl text-white">
                    {partnerName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Pulse animation when ringing/connecting */}
            {(callStatus === 'ringing' || callStatus === 'connecting' || isConnecting) && (
              <div className="absolute inset-0 rounded-full animate-ping bg-purple-400 opacity-75"></div>
            )}
            
            {/* Green dot when connected */}
            {callStatus === 'connected' && (
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>

          {/* Partner Name */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {partnerName}
          </h2>
          
          {/* Call Status */}
          <p className={`text-sm mb-6 ${getStatusColor()}`}>
            {getCallStatusText()}
          </p>

          {/* Call Duration */}
          {callStatus === 'connected' && (
            <p className="text-gray-300 text-lg font-mono mb-6">
              {formatDuration(callDuration)}
            </p>
          )}

          {/* Wave animation for active call */}
          {callStatus === 'connected' && (
            <div className="flex justify-center items-center gap-1 mb-6">
              <div className="w-1 h-4 bg-green-500 rounded-full animate-wave1"></div>
              <div className="w-1 h-8 bg-green-500 rounded-full animate-wave2"></div>
              <div className="w-1 h-12 bg-green-500 rounded-full animate-wave3"></div>
              <div className="w-1 h-8 bg-green-500 rounded-full animate-wave2"></div>
              <div className="w-1 h-4 bg-green-500 rounded-full animate-wave1"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Call Controls */}
      <div className="bg-gray-900 p-6 pb-8">
        <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
          {/* Mute Button */}
          <button
            onClick={handleToggleMic}
            className={`p-4 rounded-full transition-all transform hover:scale-110 ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          
          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-5 rounded-full bg-red-500 hover:bg-red-600 transition-all transform hover:scale-110 shadow-lg"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 12a7 7 0 0114 0v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4z" />
            </svg>
          </button>
          
          {/* Speaker Button */}
          <button
            onClick={handleToggleSpeaker}
            className={`p-4 rounded-full transition-all transform hover:scale-110 ${
              !isSpeakerOn ? 'bg-gray-700' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isSpeakerOn ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
        </div>
        
        {/* Hidden video elements for audio stream (required for WebRTC) */}
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
        <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes wave1 {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        @keyframes wave2 {
          0%, 100% { height: 8px; }
          50% { height: 32px; }
        }
        @keyframes wave3 {
          0%, 100% { height: 16px; }
          50% { height: 48px; }
        }
        .animate-wave1 {
          animation: wave1 1s ease-in-out infinite;
        }
        .animate-wave2 {
          animation: wave2 1s ease-in-out infinite 0.2s;
        }
        .animate-wave3 {
          animation: wave3 1s ease-in-out infinite 0.4s;
        }
      `}</style>
    </div>
  );
};

export default CallScreen;
