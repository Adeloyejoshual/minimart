// components/Profile.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
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

  // Get token from localStorage (assuming you store it there after login/register)
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
      console.error('Failed to fetch user:', err);
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

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      // Here you might want to upload to Cloudinary first and get URL
      setFormData(prev => ({ ...prev, [field]: file.name })); // Placeholder
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError('');

    try {
      const response = await axios.put('/api/users/me', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Update failed:', err);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">My Profile</h1>
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Logout
            </button>
            <button
              onClick={fetchUser}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Profile Display */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Info</h2>
            
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Email</span>
                <span className="text-lg font-semibold text-gray-900">{user?.email}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Name</span>
                <span className="text-lg font-semibold text-gray-900">{user?.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Phone</span>
                <span className="text-lg font-semibold text-gray-900">{user?.phone_number || 'Not set'}</span>
              </div>
              <div className="text-sm font-medium text-gray-500 block mb-1">Location</span>
                <span className="text-lg font-semibold text-gray-900">
                  {user?.city}, {user?.state}, {user?.country}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  user?.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user?.status || 'active'}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Balance</span>
                <span className="text-2xl font-bold text-green-600">${user?.balance || 0}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block mb-1">Last Login</span>
                <span className="text-lg text-gray-900">
                  {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h2>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Store Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
                <input
                  type="text"
                  name="store_name"
                  value={formData.store_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Description</label>
                <textarea
                  name="store_description"
                  rows="3"
                  value={formData.store_description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Images - Placeholder for Cloudinary integration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'profile_image')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.profile_image && (
                    <p className="text-sm text-gray-500 mt-1">{formData.profile_image}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'store_logo')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.store_logo && (
                    <p className="text-sm text-gray-500 mt-1">{formData.store_logo}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;