
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ==================== API URL CONFIGURATION ====================
const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://easytalk-new.onrender.com';
  }
  return 'http://localhost:5000';
};

const API_URL = getApiUrl();

// Configure axios
axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

console.log(`🔧 Axios configured with baseURL: ${API_URL}`);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Set axios default header when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('✅ Auth token set in axios headers');
    } else {
      delete axios.defaults.headers.common['Authorization'];
      console.log('❌ Auth token removed from axios headers');
    }
  }, [token]);

  // Load user on initial load
  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      console.log('📡 Loading user from server...');
      const response = await axios.get('/api/auth/me');
      
      if (response?.data?.user) {
        console.log('✅ User loaded from server:', response.data.user);
        setUser(response.data.user);
      } else {
        console.log('No user data in response');
        setUser(null);
      }
    } catch (error) {
      console.error('Load user error:', error.response?.data || error.message);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      console.log('📝 Registering user:', userData.email);
      console.log('📡 API URL:', API_URL);
      
      const response = await axios.post('/api/auth/register', {
        name: userData.fullName,
        email: userData.email,
        password: userData.password,
        gender: userData.gender
      });
      
      const { token: newToken, user } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(user);
      
      console.log('✅ Registration successful. User data:', user);
      toast.success(`Welcome to EasyTalk, ${user.name}! 🎉`);
      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  const login = async (email, password) => {
    try {
      console.log('🔐 Attempting login:', email);
      console.log('📡 API URL:', API_URL);
      
      const response = await axios.post('/api/auth/login', { email, password });
      
      const { token: newToken, user } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(user);
      
      console.log('✅ Login successful. User data:', user);
      toast.success(`Welcome back, ${user.name}! 👋`);
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      toast.error(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    loading,
    token,
    register,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    API_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
