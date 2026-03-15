// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { FiUser, FiPlus, FiUsers, FiMessageSquare, FiStar, FiHeadphones, FiEdit3, FiSettings } from "react-icons/fi";
import ProHeader from "../components/ProHeader";
import BottomNav from "../components/BottomNav";
import '../style/Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ products: 0, followers: 127, feedback: 4.8 });
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return navigate("/login");
    fetchUser();
  }, [token]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data);
      setFormData(res.data);
    } catch {
      localStorage.removeItem("token");
      navigate("/login");
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put("/api/users/me", formData, { headers: { Authorization: `Bearer ${token}` } });
      setIsEditing(false);
      fetchUser();
    } catch {
      setError("Update failed");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div>
    </div>
  );

  return (
    <div className="profile-page">
      <ProHeader title="Profile" showBack={true} />
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Profile Card */}
        <div className="profile-card">
          <div className="flex items-center gap-6">
            <div className="profile-avatar">
              {user?.profile_image ? <img src={user.profile_image} alt="profile" className="w-full h-full rounded-full object-cover" /> : <FiUser />}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user?.name || "User"}</h1>
              <p className="text-gray-500 text-lg">{user?.store_name || "Marketplace Seller"}</p>
              <p className="text-blue-600 text-sm">{user?.email}</p>
            </div>
          </div>
          <Link to="/settings" className="ml-auto bg-gray-900 text-white px-6 py-3 rounded-xl shadow hover:bg-black flex items-center gap-2">
            <FiSettings className="w-5 h-5" /> Settings
          </Link>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stats-card"><FiPlus className="stats-icon text-indigo-600"/><div className="text-2xl font-bold">{stats.products}</div><div className="text-gray-500 text-sm">Products</div></div>
          <div className="stats-card"><FiUsers className="stats-icon text-green-600"/><div className="text-2xl font-bold">{stats.followers}</div><div className="text-gray-500 text-sm">Followers</div></div>
          <Link to="/conversations" className="stats-card hover:shadow-md transition"><FiMessageSquare className="stats-icon text-purple-600"/><div className="text-2xl font-bold">24</div><div className="text-gray-500 text-sm">Messages</div></Link>
          <div className="stats-card"><FiStar className="stats-icon text-yellow-500"/><div className="text-2xl font-bold">{stats.feedback}</div><div className="text-gray-500 text-sm">Rating</div></div>
        </div>

        {/* Profile Info */}
        <div className="info-card">
          <div className="info-header">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FiEdit3/> Profile Information</h2>
            <button onClick={() => setIsEditing(!isEditing)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl">{isEditing ? "Cancel" : "Edit"}</button>
          </div>
          {error && <div className="text-red-600 mb-4">{error}</div>}
          {isEditing ? (
            <form onSubmit={handleSubmit} className="info-grid">
              <input name="store_name" value={formData.store_name || ""} onChange={handleInputChange} placeholder="Store name" className="border p-3 rounded-xl"/>
              <input name="phone_number" value={formData.phone_number || ""} onChange={handleInputChange} placeholder="Phone number" className="border p-3 rounded-xl"/>
              <button type="submit" className="md:col-span-3 bg-green-600 text-white py-3 rounded-xl">Save Changes</button>
            </form>
          ) : (
            <div className="info-grid text-center">
              <div className="border rounded-xl p-5"><div className="text-sm text-gray-500">Phone</div><div className="text-lg font-semibold">{user?.phone_number || "Not set"}</div></div>
              <div className="border rounded-xl p-5"><div className="text-sm text-gray-500">Country</div><div className="text-lg font-semibold">{user?.country || "Not set"}</div></div>
              <div className="border rounded-xl p-5"><div className="text-sm text-gray-500">Balance</div><div className="text-lg font-semibold">{user?.balance || 0} NGN</div></div>
            </div>
          )}
        </div>

        {/* Support Button */}
        <Link to="/support" className="support-btn"><FiHeadphones className="w-6 h-6"/></Link>

      </div>
      <BottomNav/>
    </div>
  );
};

export default Profile;