import SimplePeer from 'simple-peer';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
  }

  async initLocalStream(video = true, audio = true) {
    try {
      const constraints = {
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audio,
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  createPeer(isInitiator, stream, onSignal, onStream, onError) {
    this.peer = new SimplePeer({
      initiator: isInitiator,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    this.peer.on('signal', (data) => {
      onSignal(data);
    });

    this.peer.on('stream', (stream) => {
      this.remoteStream = stream;
      onStream(stream);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
      onError(err);
    });

    return this.peer;
  }

  handleSignal(signal) {
    if (this.peer) {
      this.peer.signal(signal);
    }
  }

  endCall() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.remoteStream = null;
  }

  toggleMic(enabled) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
    }
  }
}

export default new WebRTCService();