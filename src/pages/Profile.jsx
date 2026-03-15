// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import ProHeader from "../components/ProHeader";
import BottomNav from "../components/BottomNav";

import {
  FiUser,
  FiPlus,
  FiUsers,
  FiMessageSquare,
  FiStar,
  FiHeadphones,
  FiEdit3,
  FiSettings
} from "react-icons/fi";

const Profile = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    products: 0,
    followers: 127,
    feedback: 4.8
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    fetchUser();
  }, [token]);

  const fetchUser = async () => {
    try {
      setLoading(true);

      const res = await axios.get("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUser(res.data);
      setFormData(res.data);

    } catch (err) {

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }

      setError("Failed to load profile");

    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      await axios.put("/api/users/me", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsEditing(false);
      fetchUser();

    } catch {
      setError("Update failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">

      {/* Header */}
      <ProHeader title="Profile" showBack={true} />

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Profile Header */}

        <div className="text-center mb-12 relative">

          {/* Settings Button */}

          <Link
            to="/settings"
            className="absolute right-0 top-0 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow hover:bg-indigo-700 flex items-center gap-2"
          >
            <FiSettings className="w-5 h-5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>

          {/* Avatar */}

          <div className="w-32 h-32 rounded-full bg-purple-500 mx-auto flex items-center justify-center text-white text-5xl mb-6 shadow-xl">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt="profile"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <FiUser />
            )}
          </div>

          {/* Name */}

          <h1 className="text-4xl font-bold mb-2">
            {user?.name || "User"}
          </h1>

          <p className="text-gray-600 text-lg">
            {user?.store_name || "Marketplace Seller"}
          </p>

          <p className="text-blue-600">{user?.email}</p>

        </div>

        {/* Stats */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">

          <Link
            to="/minimart/add"
            className="bg-blue-600 text-white p-6 rounded-2xl text-center shadow hover:scale-105 transition"
          >
            <FiPlus className="mx-auto mb-2 w-8 h-8" />
            <div className="text-2xl font-bold">{stats.products}</div>
            <div className="text-sm">Products</div>
          </Link>

          <div className="bg-white p-6 rounded-2xl shadow text-center">
            <FiUsers className="mx-auto mb-2 text-green-600 w-8 h-8" />
            <div className="text-2xl font-bold">{stats.followers}</div>
            <div className="text-sm text-gray-500">Followers</div>
          </div>

          <Link
            to="/conversations"
            className="bg-purple-600 text-white p-6 rounded-2xl text-center shadow hover:scale-105 transition"
          >
            <FiMessageSquare className="mx-auto mb-2 w-8 h-8" />
            <div className="text-2xl font-bold">24</div>
            <div className="text-sm">Messages</div>
          </Link>

          <div className="bg-white p-6 rounded-2xl shadow text-center">
            <FiStar className="mx-auto mb-2 text-yellow-500 w-8 h-8" />
            <div className="text-2xl font-bold">{stats.feedback}</div>
            <div className="text-sm text-gray-500">Rating</div>
          </div>

        </div>

        {/* Profile Details */}

        <div className="bg-white rounded-3xl shadow p-8">

          <div className="flex justify-between items-center mb-6">

            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FiEdit3 /> Profile Details
            </h2>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>

          </div>

          {error && (
            <div className="text-red-600 mb-4">{error}</div>
          )}

          {isEditing ? (

            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">

              <input
                name="store_name"
                value={formData.store_name || ""}
                onChange={handleInputChange}
                placeholder="Store name"
                className="border p-3 rounded-xl"
              />

              <input
                name="phone_number"
                value={formData.phone_number || ""}
                onChange={handleInputChange}
                placeholder="Phone number"
                className="border p-3 rounded-xl"
              />

              <button
                type="submit"
                className="md:col-span-2 bg-green-600 text-white py-3 rounded-xl"
              >
                Save Changes
              </button>

            </form>

          ) : (

            <div className="grid md:grid-cols-3 gap-6 text-center">

              <div className="p-6 bg-blue-50 rounded-2xl">
                <div className="text-xl font-bold">
                  {user?.phone_number || "Not set"}
                </div>
                <div className="text-sm text-blue-600">Phone</div>
              </div>

              <div className="p-6 bg-green-50 rounded-2xl">
                <div className="text-xl font-bold">
                  {user?.country || "Not set"}
                </div>
                <div className="text-sm text-green-600">Country</div>
              </div>

              <div className="p-6 bg-purple-50 rounded-2xl">
                <div className="text-xl font-bold">
                  {user?.balance || 0} NGN
                </div>
                <div className="text-sm text-purple-600">Balance</div>
              </div>

            </div>

          )}

        </div>

        {/* Support Button */}

        <Link
          to="/support"
          className="fixed bottom-28 left-6 bg-green-600 text-white w-20 h-20 rounded-2xl flex flex-col items-center justify-center shadow-xl"
        >
          <FiHeadphones className="w-8 h-8" />
          <span className="text-xs">Support</span>
        </Link>

      </div>

      {/* Bottom Navigation */}
      <BottomNav />

    </div>
  );
};

export default Profile;