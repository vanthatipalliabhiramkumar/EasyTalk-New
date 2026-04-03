import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import ProtectedRoute from './components/common/ProtectedRoute';

// Import components correctly
import Home from './pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Premium from './pages/Premium';
import ChatWindow from './components/chat/ChatWindow';
import AITeacher from './components/ai/AITeacher';
import Challenges from './components/challenges/Challenges';
import CallScreen from './components/call/CallScreen';
import WaitingScreen from './components/call/WaitingScreen';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
              <Route path="/chat/:userId" element={<ProtectedRoute><ChatWindow /></ProtectedRoute>} />
              <Route path="/ai-teacher" element={<ProtectedRoute><AITeacher /></ProtectedRoute>} />
              <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
              <Route path="/call/:callId" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />
              <Route path="/waiting/:type" element={<ProtectedRoute><WaitingScreen /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;