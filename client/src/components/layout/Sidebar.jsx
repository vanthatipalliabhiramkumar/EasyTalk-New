import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FaHome, 
  FaComments, 
  FaPhone, 
  FaRobot, 
  FaTrophy, 
  FaChartLine,
  FaSignOutAlt,
  FaUser,
  FaCrown
} from 'react-icons/fa';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', icon: FaHome, label: 'Home' },
    { path: '/chat', icon: FaComments, label: 'Chat with Partner' },
    { path: '/call', icon: FaPhone, label: 'Talk with Partner' },
    { path: '/ai-teacher', icon: FaRobot, label: 'AI Teacher' },
    { path: '/challenges', icon: FaTrophy, label: 'Challenges' },
    { path: '/dashboard', icon: FaChartLine, label: 'Dashboard' }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.fullName || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-blue-600">EasyTalk</h1>
        <p className="text-sm text-gray-500 mt-1">Speak English Confidently</p>
      </div>

      {/* User Profile Summary */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          {user?.avatar ? (
            <img src={user.avatar} alt={displayName} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {userInitial}
            </div>
          )}
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{displayName}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <NavLink to="/profile" className="text-gray-400 hover:text-blue-600">
            <FaUser />
          </NavLink>
        </div>
        
        {/* Streak Badge */}
        <div className="mt-3 flex items-center justify-between bg-orange-100 px-3 py-1 rounded-full">
          <span className="text-xs text-orange-700">🔥 {user?.streak || 0} day streak</span>
          {user?.isPremium && (
            <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center">
              <FaCrown className="mr-1 text-xs" /> PREMIUM
            </span>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            <item.icon className="text-xl" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <FaSignOutAlt className="text-xl" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;