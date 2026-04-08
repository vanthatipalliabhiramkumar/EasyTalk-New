import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

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
  const [callType, setCallType] = useState('audio'); // Always audio
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState('');
  
  const peerRef = useRef(null);
  const localVideoRef = useRef(null); // Used for audio stream
  const remoteVideoRef = useRef(null); // Used for audio stream
  const durationRef = useRef(null);
  
  const { socket } = useSocket();
  const { user } = useAuth();

  // Call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      durationRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (durationRef.current) {
      clearInterval(durationRef.current);
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [callStatus]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('incoming_call', (data) => {
      console.log('📞 Incoming call:', data);
      setIncomingCall(data);
      setPartnerName(data.callerName);
      setPartnerAvatar(data.callerAvatar);
      
      toast.custom((t) => (
        <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full">
          <div className="flex items-center space-x-3">
            <img src={data.callerAvatar} alt={data.callerName} className="w-12 h-12 rounded-full ring-2 ring-green-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{data.callerName}</p>
              <p className="text-sm text-gray-500">is calling you...</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => { acceptCall(data); toast.dismiss(t.id); }} 
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
              >
                Accept
              </button>
              <button 
                onClick={() => { rejectCall(data.callId, data.callerId); toast.dismiss(t.id); }} 
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ), { duration: 30000 });
    });

    socket.on('call_accepted', (data) => {
      console.log('✅ Call accepted:', data);
      setCallStatus('connected');
      toast.success('Call connected!', { icon: '📞' });
    });

    socket.on('call_rejected', (data) => {
      console.log('❌ Call rejected:', data);
      setCallStatus('idle');
      setCurrentCall(null);
      endCall();
      toast.error('Call was rejected', { icon: '❌' });
    });

    socket.on('call_ended', (data) => {
      console.log('📞 Call ended:', data);
      endCall();
      toast('Call ended', { icon: '📞' });
    });

    socket.on('offer', async (data) => {
      console.log('📡 Received WebRTC offer');
      if (peerRef.current) {
        try {
          peerRef.current.signal(data.offer);
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    socket.on('answer', async (data) => {
      console.log('📡 Received WebRTC answer');
      if (peerRef.current) {
        try {
          peerRef.current.signal(data.answer);
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    });

    socket.on('ice-candidate', async (data) => {
      console.log('📡 Received ICE candidate');
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
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket]);

  const initiateCall = async (receiverId, type, name, avatar) => {
    try {
      console.log('📞 Initiating audio call to:', receiverId);
      
      // Audio only - no video
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: false, 
        audio: true 
      });
      
      setLocalStream(stream);
      setCallType('audio');
      setCallStatus('ringing');
      setPartnerName(name || 'Partner');
      setPartnerAvatar(avatar || '');
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      const SimplePeer = (await import('simple-peer')).default;
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });
      
      peerRef.current = peer;
      
      peer.on('signal', (data) => {
        console.log('📡 Sending WebRTC offer');
        socket.emit('offer', { 
          to: receiverId, 
          offer: data,
          callId: Date.now()
        });
      });
      
      peer.on('stream', (remoteStream) => {
        console.log('📡 Received remote audio stream');
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
      
      peer.on('connect', () => {
        console.log('🔗 Peer connected');
        setCallStatus('connected');
      });
      
      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Connection error');
        endCall();
      });
      
      socket.emit('initiate_call', {
        receiverId,
        callType: 'audio',
        callerId: user.id,
        callerName: user.name,
        callerAvatar: user.avatar
      });
      
      setCurrentCall({ receiverId, callType: 'audio', name });
      
      setTimeout(() => {
        if (callStatus === 'ringing') {
          toast.error('No answer. Call timed out.');
          endCall();
        }
      }, 30000);
      
    } catch (error) {
      console.error('Initiate call error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow microphone access');
      } else {
        toast.error('Failed to start call: ' + error.message);
      }
      endCall();
    }
  };
  
  const acceptCall = async (callData) => {
    try {
      const { callId, callerId, callerName, callerAvatar, callType: type } = callData;
      console.log('📞 Accepting audio call from:', callerName);
      
      // Audio only - no video
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: false, 
        audio: true 
      });
      
      setLocalStream(stream);
      setCallType('audio');
      setCurrentCall({ callId, callerId, callType: 'audio' });
      setCallStatus('connecting');
      setIncomingCall(null);
      setPartnerName(callerName);
      setPartnerAvatar(callerAvatar);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      const SimplePeer = (await import('simple-peer')).default;
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });
      
      peerRef.current = peer;
      
      peer.on('signal', (data) => {
        console.log('📡 Sending WebRTC answer');
        socket.emit('answer', { 
          to: callerId, 
          answer: data,
          callId: callId
        });
      });
      
      peer.on('stream', (remoteStream) => {
        console.log('📡 Received remote audio stream');
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
      
      peer.on('connect', () => {
        console.log('🔗 Peer connected');
        setCallStatus('connected');
      });
      
      peer.on('error', (err) => {
        console.error('Peer error:', err);
        toast.error('Connection error');
        endCall();
      });
      
      socket.emit('accept_call', { 
        callId, 
        callerId,
        receiverId: user.id,
        receiverName: user.name,
        receiverAvatar: user.avatar
      });
      
    } catch (error) {
      console.error('Accept call error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Please allow microphone access');
      } else {
        toast.error('Failed to accept call');
      }
      endCall();
    }
  };
  
  const rejectCall = (callId, callerId) => {
    console.log('📞 Rejecting call:', callId);
    socket.emit('reject_call', { callId, callerId });
    setIncomingCall(null);
    toast('Call rejected', { icon: '❌' });
  };
  
  const endCall = () => {
    console.log('📞 Ending call');
    
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
    
    if (currentCall?.receiverId) {
      socket.emit('end_call', { 
        to: currentCall.receiverId,
        callId: currentCall.callId,
        userId: user.id,
        userName: user.name
      });
    }
    
    if (currentCall?.callerId) {
      socket.emit('end_call', { 
        to: currentCall.callerId,
        callId: currentCall.callId,
        userId: user.id,
        userName: user.name
      });
    }
    
    setCurrentCall(null);
    setCallStatus('idle');
    setCallType(null);
    setIncomingCall(null);
    setCallDuration(0);
    setPartnerName('');
    setPartnerAvatar('');
    
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
      audioTracks.forEach(track => track.enabled = !track.enabled);
      const isMuted = !audioTracks[0]?.enabled;
      toast(isMuted ? 'Microphone muted' : 'Microphone unmuted', { icon: isMuted ? '🔇' : '🎤' });
    }
  };
  
  return (
    <CallContext.Provider value={{
      currentCall, callStatus, callType, callDuration, localStream, remoteStream,
      localVideoRef, remoteVideoRef, incomingCall, partnerName, partnerAvatar,
      initiateCall, acceptCall, rejectCall, endCall, toggleMic
    }}>
      {children}
    </CallContext.Provider>
  );
};
