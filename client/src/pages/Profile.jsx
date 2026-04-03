import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Sidebar from '../components/layout/Sidebar';
import { FaEdit, FaSave, FaTimes, FaLock, FaPhone, FaEnvelope, FaMapMarker, FaVenusMars } from 'react-icons/fa';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    mobileNumber: user?.mobileNumber || '',
    gender: user?.gender || '',
    state: user?.state || '',
    avatar: user?.avatar || ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put('/api/users/profile', formData);
      updateUser(response.data.user);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Profile Header */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-primary-600 to-primary-800 h-32"></div>
            <div className="relative px-6 pb-6">
              <div className="flex justify-between items-start">
                <div className="relative -mt-16">
                  <img
                    src={user?.avatar}
                    alt={user?.fullName}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
                  />
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700">
                      <FaEdit size={12} />
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <FaEdit />
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <FaTimes />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn-primary flex items-center space-x-2"
                      >
                        {loading ? <LoadingSpinner size="sm" /> : <FaSave />}
                        <span>Save</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4">
                {!isEditing ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-800">{user?.fullName}</h2>
                    <div className="flex items-center space-x-2 mt-1">
                      {user?.isPremium && (
                        <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                          <FaLock className="mr-1" size={10} /> Premium
                        </span>
                      )}
                      <span className="text-gray-500 text-sm">Member since {new Date(user?.createdAt).toLocaleDateString()}</span>
                    </div>
                  </>
                ) : (
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="text-2xl font-bold text-gray-800 input-field w-full"
                    placeholder="Full Name"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <FaEnvelope className="text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="text-gray-800">{user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <FaPhone className="text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Mobile Number</p>
                  {!isEditing ? (
                    <p className="text-gray-800">{user?.mobileNumber}</p>
                  ) : (
                    <input
                      type="tel"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      className="input-field mt-1"
                      placeholder="Mobile Number"
                    />
                  )}
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <FaVenusMars className="text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Gender</p>
                  {!isEditing ? (
                    <p className="text-gray-800">{user?.gender}</p>
                  ) : (
                    <div className="flex space-x-4 mt-1">
                      {['Male', 'Female', 'Other'].map(gender => (
                        <label key={gender} className="flex items-center">
                          <input
                            type="radio"
                            name="gender"
                            value={gender}
                            checked={formData.gender === gender}
                            onChange={handleChange}
                            className="mr-2"
                          />
                          <span>{gender}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <FaMapMarker className="text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">State</p>
                  {!isEditing ? (
                    <p className="text-gray-800">{user?.state}</p>
                  ) : (
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="input-field mt-1"
                    >
                      <option value="">Select your state</option>
                      {states.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">{user?.streak || 0}</div>
              <p className="text-gray-600">Day Streak</p>
              <p className="text-xs text-gray-400 mt-1">Keep practicing daily!</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">{user?.totalCalls || 0}</div>
              <p className="text-gray-600">Total Calls</p>
              <p className="text-xs text-gray-400 mt-1">Voice & video calls</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">{user?.totalMinutes || 0}</div>
              <p className="text-gray-600">Minutes Spent</p>
              <p className="text-xs text-gray-400 mt-1">Speaking practice</p>
            </div>
          </div>

          {/* Premium Status */}
          {!user?.isPremium && (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between flex-wrap">
                <div>
                  <h3 className="text-xl font-bold mb-2">Go Premium!</h3>
                  <p className="opacity-90">Get unlimited calls, priority matching, and exclusive features</p>
                </div>
                <button className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition-shadow">
                  Upgrade Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;