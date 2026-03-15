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
      const res = await axios.get("/api/users/me", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
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
    <div className="profile-page min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <ProHeader title="Profile" showBack={true} />

      {/* Profile Card */}
      <div className="profile-card bg-white shadow-xl rounded-3xl p-6 mx-4 mt-6 flex items-center gap-6">
        <div className="profile-avatar w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-500 flex items-center justify-center bg-indigo-100">
          {user?.profile_image ? (
            <img src={user.profile_image} alt="profile" className="w-full h-full object-cover" />
          ) : (
            <FiUser className="text-indigo-500 w-12 h-12" />
          )}
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{user?.name || "User"}</h1>
          <p className="text-gray-500 text-lg">{user?.store_name || "Marketplace Seller"}</p>
          <p className="text-blue-600 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Menu List */}
      <div className="menu-list mt-8 mx-4 grid gap-4">
        <Link to="/dashboard" className="menu-item hover:bg-indigo-50"><FiUsers className="menu-icon"/> Dashboard</Link>
        <Link to="/leaderboard" className="menu-item hover:bg-indigo-50"><FiStar className="menu-icon"/> Leaderboard</Link>
        <Link to="/coupons" className="menu-item hover:bg-indigo-50"><FiGift className="menu-icon"/> Coupons</Link>
        <Link to="/minimart/add" className="menu-item hover:bg-indigo-50"><FiPlus className="menu-icon"/> Add Product</Link>
        <Link to="/wallet" className="menu-item hover:bg-indigo-50"><FiCreditCard className="menu-icon"/> Wallet</Link>
        <Link to="/verification" className="menu-item hover:bg-indigo-50"><FiCheckCircle className="menu-icon"/> Verification</Link>
        <Link to="/become-seller" className="menu-item hover:bg-indigo-50"><FiUser className="menu-icon"/> Become Seller</Link>
        <Link to="/faq" className="menu-item hover:bg-indigo-50"><FiFileText className="menu-icon"/> FAQ</Link>
        <Link to="/complain" className="menu-item hover:bg-indigo-50"><FiMessageSquare className="menu-icon"/> Complain</Link>
      </div>

      {/* Floating Support Button */}
      <Link to="/support" className="support-btn fixed bottom-32 right-6 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-500 text-white p-4 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all z-50 flex items-center justify-center">
        <FiHeadphones className="w-6 h-6"/>
      </Link>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default Profile;