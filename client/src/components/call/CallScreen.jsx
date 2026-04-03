import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { FaPhone, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaPhoneSlash, FaUser } from 'react-icons/fa';
import toast from 'react-hot-toast';

const CallScreen = () => {
  const { userId } = useParams();
  const { user, token } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const navigate = useNavigate();
  
  const [callStatus, setCallStatus] = useState('connecting');
  const [callType, setCallType] = useState('video');
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [partner, setPartner] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Fetch partner details immediately when component mounts
  useEffect(() => {
    fetchPartner();
  }, [userId]);

  // Log when partner is set
  useEffect(() => {
    if (partner) {
      console.log('Partner set:', partner);
    }
  }, [partner]);

  // Initialize WebRTC
  useEffect(() => {
    if (!socket || !user) return;

    initWebRTC();

    // Listen for call events
    socket.on('call_accepted', () => {
      console.log('Call accepted');
      setCallStatus('connected');
      startTimer();
      toast.success('Call connected');
    });

    socket.on('call_rejected', () => {
      console.log('Call rejected');
      toast.error('Call was rejected');
      endCall();
    });

    socket.on('call_ended', () => {
      console.log('Call ended by partner');
      toast.info('Call ended');
      endCall();
    });

    // WebRTC signaling
    socket.on('webrtc_offer', async ({ offer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit('webrtc_answer', { targetUserId: userId, answer });
      }
    });

    socket.on('webrtc_answer', async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc_ice_candidate', ({ candidate }) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
    };
  }, [socket, user]);

  const fetchPartner = async () => {
    try {
      console.log('Fetching partner with ID:', userId);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      console.log('Partner API response:', data);
      
      if (data.success && data.user) {
        setPartner({
          id: data.user.id,
          name: data.user.name || 'Partner',
          avatar: data.user.avatar
        });
      } else {
        // Fallback - try to get from online users
        const onlinePartner = onlineUsers?.find(u => u.userId === userId);
        if (onlinePartner) {
          setPartner({
            id: onlinePartner.userId,
            name: onlinePartner.userName || 'Partner',
            avatar: onlinePartner.userAvatar
          });
        } else {
          setPartner({
            id: userId,
            name: 'Partner',
            avatar: null
          });
        }
      }
    } catch (error) {
      console.error('Fetch partner error:', error);
      // Try to get from online users as fallback
      const onlinePartner = onlineUsers?.find(u => u.userId === userId);
      if (onlinePartner) {
        setPartner({
          id: onlinePartner.userId,
          name: onlinePartner.userName || 'Partner',
          avatar: onlinePartner.userAvatar
        });
      } else {
        setPartner({
          id: userId,
          name: 'Partner',
          avatar: null
        });
      }
    }
  };

  const initWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };
      
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Add tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote stream');
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc_ice_candidate', {
            targetUserId: userId,
            candidate: event.candidate
          });
        }
      };

      // Create offer (initiator)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc_offer', { targetUserId: userId, offer });

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          endCall();
        }
      };

    } catch (error) {
      console.error('WebRTC init error:', error);
      toast.error('Failed to access camera/microphone');
      endCall();
    }
  };

  const startTimer = () => {
    timerIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setMicMuted(!micMuted);
      toast.success(micMuted ? 'Microphone unmuted' : 'Microphone muted');
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoOff(!videoOff);
      toast.success(videoOff ? 'Video turned on' : 'Video turned off');
    }
  };

  const endCall = () => {
    if (callEnded) return;
    
    setCallEnded(true);
    
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Notify server
    if (socket && userId) {
      socket.emit('end_call', {
        callId: userId,
        callerId: user.id,
        receiverId: userId
      });
    }
    
    setCallStatus('ended');
    toast.info('Call ended');
    
    // Redirect to home after 2 seconds
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const isUserOnline = onlineUsers?.some(u => u.userId === userId);

  // Get the partner's display name
  const partnerName = partner?.name || 'Partner';
  const partnerInitial = partnerName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Call Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-white font-semibold text-lg">{partnerName}</h2>
            <p className="text-xs text-gray-400">
              {callStatus === 'connected' ? (
                <span className="text-green-500">Connected • {formatDuration(callDuration)}</span>
              ) : callStatus === 'connecting' ? (
                <span className="text-yellow-500">Connecting...</span>
              ) : (
                <span className="text-red-500">Call ended</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className={`grid ${callType === 'video' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 w-full h-full max-w-6xl`}>
          {/* Remote Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden">
            {callType === 'video' && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-5xl font-bold">{partnerInitial}</span>
                  </div>
                  <p className="text-white text-xl font-semibold">{partnerName}</p>
                  <p className="text-gray-400 text-sm mt-2">
                    {callStatus === 'connected' ? 'In call' : 'Connecting...'}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded-full">
              <p className="text-white text-sm font-medium">{partnerName}</p>
            </div>
          </div>

          {/* Local Video (Self) */}
          {callType === 'video' && (
            <div className="relative bg-gray-800 rounded-lg overflow-hidden">
              {localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded-full">
                <p className="text-white text-sm">You</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Controls */}
      <div className="bg-gray-800 p-6 flex-shrink-0">
        <div className="flex justify-center space-x-6">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all ${
              micMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {micMuted ? <FaMicrophoneSlash className="text-white text-2xl" /> : <FaMicrophone className="text-white text-2xl" />}
          </button>

          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all ${
                videoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {videoOff ? <FaVideoSlash className="text-white text-2xl" /> : <FaVideo className="text-white text-2xl" />}
            </button>
          )}

          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all"
          >
            <FaPhoneSlash className="text-white text-2xl" />
          </button>
        </div>

        <p className="text-center text-gray-400 text-sm mt-4">
          {callStatus === 'connecting' && 'Connecting...'}
          {callStatus === 'connected' && `Call in progress • ${formatDuration(callDuration)}`}
          {callStatus === 'ended' && 'Call ended - Redirecting to home...'}
        </p>
      </div>
    </div>
  );
};

export default CallScreen;