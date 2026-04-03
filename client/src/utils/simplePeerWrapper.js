// This file wraps simple-peer to handle browser compatibility
import SimplePeer from 'simple-peer';

// Fix for global is not defined
if (typeof window !== 'undefined' && !window.global) {
  window.global = window;
}

if (typeof global === 'undefined') {
  window.global = window;
}

export default SimplePeer;