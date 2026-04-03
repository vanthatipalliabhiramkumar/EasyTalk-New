import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

// Dynamic import for simple-peer to avoid build issues
let SimplePeer;
const loadSimplePeer = async () => {
  if (!SimplePeer) {
    const module = await import('simple-peer');
    SimplePeer = module.default;
  }
  return SimplePeer;
};

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const [currentCall, setCurrentCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket) return;

    // Listen for incoming calls
    socket.on('incoming_call', (data) => {
      console.log('Incoming call:', data);
      setIncomingCall(data);
      
      // Show notification
      toast.custom((t) => (
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm w-full">
          <div className="flex items-center space-x-3">
            <img 
              src={data.caller.avatar} 
              alt={data.caller.fullName}
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{data.caller.fullName}</p>
              <p className="text-sm text-gray-500">is calling you...</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => acceptCall(data)}
                className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={() => rejectCall(data.callId)}
                className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ), { duration: 30000 });
    });

    // Listen for call accepted
    socket.on('call_accepted', (data) => {
      console.log('Call accepted:', data);
      setCallStatus('connected');
      toast.success('Call connected!');
    });

    // Listen for call rejected
    socket.on('call_rejected', (data) => {
      console.log('Call rejected:', data);
      setCallStatus('idle');
      setCurrentCall(null);
      endCall();
      toast.error('Call was rejected');
    });

    // Listen for call ended
    socket.on('call_ended', (data) => {
      console.log('Call ended:', data);
      endCall();
      toast.info('Call ended');
    });

    // WebRTC signaling
    socket.on('webrtc_offer', async (data) => {
      console.log('Received WebRTC offer');
      if (peerRef.current) {
        try {
          const Peer = await loadSimplePeer();
          peerRef.current.signal(data.offer);
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    socket.on('webrtc_answer', async (data) => {
      console.log('Received WebRTC answer');
      if (peerRef.current) {
        try {
          peerRef.current.signal(data.answer);
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    });

    socket.on('webrtc_ice_candidate', async (data) => {
      console.log('Received ICE candidate');
      if (peerRef.current) {
        try {
          peerRef.current.signal(data.candidate);
        } catch (error) {
          console.error('Error handling ICE candidate:', error);
        }
      }
    });

    return () => {
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
    };
  }, [socket]);

  const initiateCall = async (receiverId, type) => {
    try {
      console.log('Initiating call to:', receiverId, type);
      
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      
      setLocalStream(stream);
      setCallType(type);
      setCallStatus('ringing');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Load SimplePeer
      const Peer = await loadSimplePeer();
      
      // Create peer connection
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      
      peerRef.current = peer;
      
      peer.on('signal', (data) => {
        console.log('Signal generated');
        socket.emit('webrtc_offer', {
          targetUserId: receiverId,
          offer: data
        });
      });
      
      peer.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
      
      peer.on('connect', () => {
        console.log('Peer connected');
        setCallStatus('connected');
      });
      
      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Connection error: ' + err.message);
        endCall();
      });
      
      // Emit call initiation
      socket.emit('initiate_call', {
        receiverId,
        callType: type
      });
      
      // Set timeout for no answer
      setTimeout(() => {
        if (callStatus === 'ringing') {
          toast.error('No answer. Call timed out.');
          endCall();
        }
      }, 30000);
      
    } catch (error) {
      console.error('Initiate call error:', error);
      toast.error('Failed to start call: ' + error.message);
      endCall();
    }
  };
  
  const acceptCall = async (callData) => {
    try {
      const { callId, caller, callType: type } = callData;
      console.log('Accepting call from:', caller, type);
      
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      
      setLocalStream(stream);
      setCallType(type);
      setCurrentCall({ callId, caller });
      setCallStatus('connecting');
      setIncomingCall(null);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Load SimplePeer
      const Peer = await loadSimplePeer();
      
      // Create peer connection
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      
      peerRef.current = peer;
      
      peer.on('signal', (data) => {
        console.log('Signal generated');
        socket.emit('webrtc_answer', {
          targetUserId: caller._id,
          answer: data
        });
      });
      
      peer.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        setRemoteStream(remoteStream);
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
      
      peer.on('connect', () => {
        console.log('Peer connected');
        setCallStatus('connected');
      });
      
      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Connection error: ' + err.message);
        endCall();
      });
      
      // Accept call
      socket.emit('accept_call', { callId });
      
    } catch (error) {
      console.error('Accept call error:', error);
      toast.error('Failed to accept call: ' + error.message);
      endCall();
    }
  };
  
  const rejectCall = (callId) => {
    console.log('Rejecting call:', callId);
    socket.emit('reject_call', { callId });
    setIncomingCall(null);
    toast.info('Call rejected');
  };
  
  const endCall = () => {
    console.log('Ending call');
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    
    if (currentCall) {
      socket.emit('end_call', { callId: currentCall.callId });
    }
    
    setRemoteStream(null);
    setCurrentCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIncomingCall(null);
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };
  
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      const isMuted = !audioTracks[0]?.enabled;
      toast.success(isMuted ? 'Microphone muted' : 'Microphone unmuted');
    }
  };
  
  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      const isOff = !videoTracks[0]?.enabled;
      toast.success(isOff ? 'Video turned off' : 'Video turned on');
    }
  };
  
  const value = {
    currentCall,
    callStatus,
    callType,
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleVideo
  };
  
  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};