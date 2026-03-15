// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { 
  FiUser, FiPlus, FiUsers, FiMessageSquare, FiStar, FiHeadphones, 
  FiSettings, FiGift, FiCreditCard, FiCheckCircle, FiFileText 
} from "react-icons/fi";
import ProHeader from "../components/ProHeader";
import BottomNav from "../components/BottomNav";
import '../style/Profile.css';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
    } catch {
      localStorage.removeItem("token");
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div>
    </div>
  );

  return (
    <div className="profile-page">
      {/* Header */}
      <ProHeader title="Profile" showBack={true} />

      {/* Profile Card */}
      <div className="profile-card mb-6">
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
      </div>

      {/* Menu List */}
      <div className="menu-list">
        <Link to="/dashboard" className="menu-item"><FiUsers className="menu-icon"/> Dashboard</Link>
        <Link to="/leaderboard" className="menu-item"><FiStar className="menu-icon"/> Leaderboard</Link>
        <Link to="/coupons" className="menu-item"><FiGift className="menu-icon"/> Coupons</Link>
        <Link to="/minimart/add" className="menu-item"><FiPlus className="menu-icon"/> Add Product</Link>
        <Link to="/wallet" className="menu-item"><FiCreditCard className="menu-icon"/> Wallet</Link>
        <Link to="/verification" className="menu-item"><FiCheckCircle className="menu-icon"/> Verification</Link>
        <Link to="/become-seller" className="menu-item"><FiUser className="menu-icon"/> Become Seller</Link>
        <Link to="/faq" className="menu-item"><FiFileText className="menu-icon"/> FAQ</Link>
        <Link to="/complain" className="menu-item"><FiMessageSquare className="menu-icon"/> Complain</Link>
      </div>

      {/* Floating Support Button */}
      <Link to="/support" className="support-btn"><FiHeadphones className="w-6 h-6"/></Link>

      {/* Bottom Navigation */}
      <BottomNav/>
    </div>
  );
};

export default Profile;