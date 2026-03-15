// src/pages/Profile.jsx - Complete Professional Profile Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProHeader from '../components/ProHeader';
import BottomNav from '../components/BottomNav';
import { FiUser, FiPlus, FiUsers, FiMessageSquare, FiStar, FiHeadphones, FiEdit3 } from 'react-icons/fi';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, followers: 127, feedback: 4.8 });
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchUser();
  }, [token, navigate]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setFormData(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put('/api/users/me', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEditing(false);
      fetchUser();
    } catch (err) {
      setError('Update failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Pro Header */}
      <ProHeader title="Profile" showBack={true} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header with Avatar */}
        <div className="text-center mb-12">
          <div className="inline-block relative">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full border-8 border-white shadow-2xl mx-auto mb-6 flex items-center justify-center">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <FiUser className="w-16 h-16 text-white" />
              )}
            </div>
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
              <button className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center">
                <FiEdit3 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
            {user?.name || 'Adeloye'}
          </h1>
          <p className="text-xl text-gray-600 mb-8">{user?.store_name || 'Marketplace Seller'}</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 text-center hover:shadow-2xl transition-all">
            <FiPlus className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <div className="text-2xl font-bold text-gray-900">{stats.products}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Products</div>
          </div>
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 text-center hover:shadow-2xl transition-all">
            <FiUsers className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <div className="text-2xl font-bold text-gray-900">{stats.followers}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Followers</div>
          </div>
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 text-center hover:shadow-2xl transition-all">
            <FiMessageSquare className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <div className="text-2xl font-bold text-gray-900">24</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Messages</div>
          </div>
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 text-center hover:shadow-2xl transition-all">
            <FiStar className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <div className="text-2xl font-bold text-gray-900">{stats.feedback}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Rating</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <button className="group bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 font-semibold text-lg flex items-center space-x-3">
            <FiPlus className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span>Add New Product</span>
          </button>
          <button className="group bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 font-semibold text-lg flex items-center justify-center space-x-3">
            <FiUsers className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span>View Followers</span>
          </button>
          <button className="group bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 font-semibold text-lg flex items-center space-x-3">
            <FiMessageSquare className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span>Messages</span>
          </button>
          <button className="group bg-gradient-to-r from-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 font-semibold text-lg flex items-center space-x-3">
            <FiStar className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span>Feedback</span>
          </button>
        </div>

        {/* Edit Profile Section */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50 mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent flex items-center space-x-3">
              <FiEdit3 className="w-8 h-8" />
              <span>Profile Settings</span>
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl hover:shadow-xl transition-all"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {isEditing && (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Store Name</label>
                <input
                  name="store_name"
                  value={formData.store_name || ''}
                  onChange={handleInputChange}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 focus:border-transparent text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Phone</label>
                <input
                  name="phone_number"
                  value={formData.phone_number || ''}
                  onChange={handleInputChange}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 focus:border-transparent text-lg"
                />
              </div>
              <button
                type="submit"
                className="md:col-span-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-8 rounded-2xl font-black text-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all col-span-1 md:col-span-2"
              >
                💾 Update Profile
              </button>
            </form>
          )}
        </div>

        {/* Live Chat Support - Bottom Left */}
        <div className="fixed bottom-24 left-6 md:bottom-20 md:left-8 z-40">
          <button className="group w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center justify-center space-y-1 p-4">
            <FiHeadphones className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold -mt-1 leading-tight">Support</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default Profile;