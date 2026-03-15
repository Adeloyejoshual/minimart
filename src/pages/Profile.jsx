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
  const [activeTab, setActiveTab] = useState("dashboard");

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
            <div className="profile-avatar">{user?.profile_image ? <img src={user.profile_image} alt="profile" className="w-full h-full rounded-full object-cover" /> : <FiUser />}</div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user?.name || "User"}</h1>
              <p className="text-gray-500 text-lg">{user?.store_name || "Marketplace Seller"}</p>
              <p className="text-blue-600 text-sm">{user?.email}</p>
            </div>
          </div>
          <Link to="/settings" className="ml-auto bg-gray-900 text-white px-6 py-3 rounded-xl shadow hover:bg-black flex items-center gap-2"><FiSettings className="w-5 h-5" /> Settings</Link>
        </div>

        {/* Tabs Navigation */}
        <div className="tabs-nav">
          {["dashboard","leaderboard","coupons","wallet","verification"].map(tab => (
            <button key={tab} className={`tab-button ${activeTab===tab?"active":""}`} onClick={()=>setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase()+tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tabs Content */}
        {/* Dashboard */}
        <div className={`tab-content ${activeTab==="dashboard"?"active":""}`}>
          <div className="stats-grid">
            <div className="stats-card"><FiPlus className="stats-icon text-indigo-600"/><div className="text-2xl font-bold">{stats.products}</div><div className="text-gray-500 text-sm">Products</div></div>
            <div className="stats-card"><FiUsers className="stats-icon text-green-600"/><div className="text-2xl font-bold">{stats.followers}</div><div className="text-gray-500 text-sm">Followers</div></div>
            <Link to="/conversations" className="stats-card hover:shadow-md transition"><FiMessageSquare className="stats-icon text-purple-600"/><div className="text-2xl font-bold">24</div><div className="text-gray-500 text-sm">Messages</div></Link>
            <div className="stats-card"><FiStar className="stats-icon text-yellow-500"/><div className="text-2xl font-bold">{stats.feedback}</div><div className="text-gray-500 text-sm">Rating</div></div>
          </div>
          <div className="dashboard-grid">
            <Link to="/minimart/add" className="dashboard-card"><FiPlus className="dashboard-icon"/><span className="dashboard-label">Add Product</span></Link>
            <Link to="/orders" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#10b981,#14b8a6)'}}><FiUsers className="dashboard-icon"/><span className="dashboard-label">Orders</span></Link>
            <Link to="/conversations" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#8b5cf6,#a78bfa)'}}><FiMessageSquare className="dashboard-icon"/><span className="dashboard-label">Messages</span></Link>
            <Link to="/settings" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#f59e0b,#fbbf24)'}}><FiSettings className="dashboard-icon"/><span className="dashboard-label">Settings</span></Link>
          </div>
        </div>

        {/* Leaderboard Tab */}
        <div className={`tab-content ${activeTab==="leaderboard"?"active":""}`}>
          <div className="extra-actions-grid">
            <Link to="/leaderboard" className="extra-card" style={{background:'linear-gradient(to bottom right,#f43f5e,#f472b6)'}}><FiStar className="extra-icon"/><span className="extra-label">Leaderboard</span></Link>
          </div>
        </div>

        {/* Coupons Tab */}
        <div className={`tab-content ${activeTab==="coupons"?"active":""}`}>
          <div className="extra-actions-grid">
            <Link to="/coupons" className="extra-card" style={{background:'linear-gradient(to bottom right,#3b82f6,#60a5fa)'}}><FiPlus className="extra-icon"/><span className="extra-label">Coupons</span></Link>
          </div>
        </div>

        {/* Wallet Tab */}
        <div className={`tab-content ${activeTab==="wallet"?"active":""}`}>
          <div className="info-card">
            <h2 className="text-xl font-bold mb-4">Wallet Balance</h2>
            <div className="text-2xl font-semibold">{user?.balance || 0} NGN</div>
          </div>
        </div>

        {/* Verification Tab */}
        <div className={`tab-content ${activeTab==="verification"?"active":""}`}>
          <div className="info-card">
            <h2 className="text-xl font-bold mb-4">Seller Verification</h2>
            <p className="text-gray-600">Complete KYC & bank verification to enable seller features.</p>
            <Link to="/verification" className="mt-4 inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl shadow hover:bg-indigo-700">Verify Now</Link>
          </div>
        </div>

      </div>

      {/* Floating Support Button */}
      <Link to="/support" className="support-btn"><FiHeadphones className="w-6 h-6"/></Link>

      <BottomNav/>
    </div>
  );
};

export default Profile;