// src/pages/Profile.jsx - Updated with Settings Navigation
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import ProHeader from '../components/ProHeader';
import BottomNav from '../components/BottomNav';
import { FiUser, FiPlus, FiUsers, FiMessageSquare, FiStar, FiHeadphones, FiEdit3, FiSettings } from 'react-icons/fi';

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
        {/* Profile Header with Avatar & Settings */}
        <div className="text-center mb-12 relative">
          {/* Settings Button - Top Right */}
          <Link
            to="/settings"
            className="absolute top-0 right-0 p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex items-center space-x-2 group"
          >
            <FiSettings className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline font-semibold">Settings</span>
          </Link>

          <div className="inline-block relative">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-full border-8 border-white shadow-2xl mx-auto mb-6 flex items-center justify-center ring-4 ring-white/50">
              {user?.profile_image ? (
                <img src={user.profile_image} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <FiUser className="w-16 h-16 text-white drop-shadow-lg" />
              )}
            </div>
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
              <button className="w-14 h-14 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-center ring-2 ring-blue-200/50">
                <FiEdit3 className="w-6 h-6" />
              </button>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 bg-clip-text text-transparent mb-3 drop-shadow-lg">
            {user?.name || 'Adeloye'}
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-gray-700 mb-1 bg-white/60 px-4 py-2 rounded-2xl inline-block shadow-md">
            {user?.store_name || 'Marketplace Seller'}
          </p>
          <p className="text-lg text-blue-600 font-medium">{user?.email}</p>
        </div>

        {/* Enhanced Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <Link to="/minimart/add" className="group">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 text-center cursor-pointer">
              <FiPlus className="w-16 h-16 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="text-3xl font-black">{stats.products}</div>
              <div className="text-lg font-semibold uppercase tracking-wider opacity-90">Products</div>
            </div>
          </Link>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 hover:shadow-3xl hover:-translate-y-2 transition-all text-center">
            <FiUsers className="w-16 h-16 text-emerald-600 mx-auto mb-4 hover:rotate-12 transition-transform" />
            <div className="text-3xl font-black text-gray-900">{stats.followers}</div>
            <div className="text-lg font-semibold text-gray-600 uppercase tracking-wider">Followers</div>
          </div>
          
          <Link to="/conversations" className="group">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-300 text-center cursor-pointer">
              <FiMessageSquare className="w-16 h-16 mx-auto mb-4 group-hover:scale-110 transition-transform" />
              <div className="text-3xl font-black">24</div>
              <div className="text-lg font-semibold uppercase tracking-wider opacity-90">Messages</div>
            </div>
          </Link>
          
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/50 hover:shadow-3xl hover:-translate-y-2 transition-all text-center">
            <FiStar className="w-16 h-16 text-amber-500 mx-auto mb-4 hover:rotate-12 transition-transform" />
            <div className="text-3xl font-black text-gray-900">{stats.feedback}</div>
            <div className="text-lg font-semibold text-gray-600 uppercase tracking-wider">Rating</div>
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Link 
            to="/minimart/add"
            className="group bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 flex items-center space-x-4 text-xl font-bold cursor-pointer"
          >
            <FiPlus className="w-12 h-12 group-hover:scale-110 transition-transform flex-shrink-0" />
            <span>Add New Product</span>
          </Link>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to="/conversations" className="group bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all flex flex-col items-center text-lg">
              <FiMessageSquare className="w-12 h-12 mb-3 group-hover:scale-110 transition-transform" />
              Messages
            </Link>
            <Link to="/settings" className="group bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-8 rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all flex flex-col items-center text-lg">
              <FiSettings className="w-12 h-12 mb-3 group-hover:rotate-12 transition-transform" />
              Settings
            </Link>
          </div>
        </div>

        {/* Profile Edit Section */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-3xl mb-8 text-center">
            {error}
          </div>
        )}

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-4">
            <h2 className="text-4xl font-black bg-gradient-to-r from-gray-900 to-slate-900 bg-clip-text text-transparent flex items-center space-x-4">
              <FiEdit3 className="w-10 h-10" />
              <span>Profile Details</span>
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all text-lg whitespace-nowrap"
            >
              {isEditing ? 'Cancel' : 'Edit Details'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-4">Store Name</label>
                <input
                  name="store_name"
                  value={formData.store_name || ''}
                  onChange={handleInputChange}
                  className="w-full p-6 border-2 border-gray-200 rounded-3xl focus:ring-4 focus:ring-blue-500 focus:border-transparent text-xl font-semibold bg-white/50 backdrop-blur-sm"
                  placeholder="Enter store name"
                />
              </div>
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-4">Phone Number</label>
                <input
                  name="phone_number"
                  value={formData.phone_number || ''}
                  onChange={handleInputChange}
                  className="w-full p-6 border-2 border-gray-200 rounded-3xl focus:ring-4 focus:ring-blue-500 focus:border-transparent text-xl font-semibold bg-white/50 backdrop-blur-sm"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="lg:col-span-3">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white py-6 px-12 rounded-3xl font-black text-2xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 transition-all duration-300"
                >
                  💾 Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-center">
              <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-2 border-blue-100">
                <div className="text-3xl font-bold text-gray-900 mb-2">{user?.phone_number || 'Not set'}</div>
                <div className="text-sm uppercase tracking-wider text-blue-600 font-semibold">Phone</div>
              </div>
              <div className="p-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border-2 border-emerald-100">
                <div className="text-3xl font-bold text-gray-900 mb-2">{user?.country || 'Not set'}</div>
                <div className="text-sm uppercase tracking-wider text-emerald-600 font-semibold">Country</div>
              </div>
              <div className="p-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-100">
                <div className="text-3xl font-bold text-gray-900 mb-2">{user?.balance || 0} NGN</div>
                <div className="text-sm uppercase tracking-wider text-purple-600 font-semibold">Balance</div>
              </div>
            </div>
          )}
        </div>

        {/* Live Chat Support - Enhanced */}
        <div className="fixed bottom-28 left-6 md:bottom-24 md:left-8 z-50 animate-pulse">
          <Link
            to="/support"
            className="group w-24 h-24 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-500 text-white rounded-3xl shadow-2xl hover:shadow-3xl hover:-translate-y-3 transition-all duration-500 flex flex-col items-center justify-center space-y-2 p-4 ring-4 ring-green-200/30 backdrop-blur-xl"
          >
            <FiHeadphones className="w-10 h-10 group-hover:scale-110 transition-transform drop-shadow-lg" />
            <span className="text-sm font-bold leading-tight text-center">Live<br/>Support</span>
          </Link>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default Profile;