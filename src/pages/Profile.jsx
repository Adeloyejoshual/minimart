// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    country: '',
    state: '',
    city: '',
    profile_image: '',
    store_name: '',
    store_description: '',
    store_logo: ''
  });
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
      setFormData({
        name: response.data.name || '',
        phone_number: response.data.phone_number || '',
        country: response.data.country || '',
        state: response.data.state || '',
        city: response.data.city || '',
        profile_image: response.data.profile_image || '',
        store_name: response.data.store_name || '',
        store_description: response.data.store_description || '',
        store_logo: response.data.store_logo || ''
      });
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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      const response = await axios.put('/api/users/me', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            My Profile
          </h1>
          <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleLogout}
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-2xl hover:from-red-600 hover:to-red-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Logout
            </button>
            <button
              onClick={fetchUser}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-2xl hover:from-blue-600 hover:to-blue-700 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-2xl mb-8 max-w-2xl mx-auto">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Display Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
            <div className="flex items-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mr-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-gray-900">Profile Info</h2>
            </div>
            
            <div className="space-y-6">
              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Email
                </span>
                <p className="text-xl font-bold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-800 bg-clip-text">
                  {user?.email}
                </p>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Name
                </span>
                <p className="text-2xl font-black text-gray-900">{user?.name}</p>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Phone
                </span>
                <p className="text-xl font-bold text-gray-900">{user?.phone_number || 'Not set'}</p>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Location
                </span>
                <p className="text-xl font-bold text-gray-900">
                  {user?.city || '—'}, {user?.state || '—'}, {user?.country || '—'}
                </p>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Status
                </span>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                  user?.status === 'active' 
                    ? 'bg-green-100 text-green-800 border-2 border-green-200' 
                    : 'bg-gray-100 text-gray-800 border-2 border-gray-200'
                }`}>
                  {user?.status || 'active'}
                </span>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Balance
                </span>
                <p className="text-3xl font-black bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
                  ${user?.balance || 0}
                </p>
              </div>

              <div className="group">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 bg-gray-100 px-3 py-1 rounded-full inline-block w-fit">
                  Last Login
                </span>
                <p className="text-lg font-bold text-gray-700">
                  {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          </div>

          {/* Edit Form Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.5h3m1.5-3l-3-3m0 0H3l3 3m6.5 0v1a2.5 2.5 0 005 0v-1m-9 0h9" />
                  </svg>
                </div>
                <h2 className="text-3xl font-black text-gray-900">Edit Profile</h2>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Phone Number</label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Store Name</label>
                  <input
                    type="text"
                    name="store_name"
                    value={formData.store_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Store Description</label>
                  <textarea
                    name="store_description"
                    rows="4"
                    value={formData.store_description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg resize-vertical"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-8 rounded-2xl font-black text-xl shadow-2xl hover:from-emerald-600 hover:to-teal-700 transform hover:-translate-y-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? '⏳ Updating...' : '💾 Save Changes'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;