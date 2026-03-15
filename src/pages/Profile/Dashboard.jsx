// Page/Profile/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiUsers, FiMessageSquare, FiStar, FiSettings } from "react-icons/fi";
import axios from "axios";
import '../style/Profile.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    products: 0,
    followers: 0,
    orders: 0,
    messages: 0,
    feedback: 0,
  });

  useEffect(() => {
    // fetch dashboard stats from API
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/dashboard/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="dashboard-section p-6">
      {/* Stats Row */}
      <div className="stats-grid mb-6">
        <div className="stats-card">
          <FiPlus className="stats-icon text-indigo-600" />
          <div className="stats-value">{stats.products}</div>
          <div className="stats-label">Products</div>
        </div>
        <div className="stats-card">
          <FiUsers className="stats-icon text-green-600" />
          <div className="stats-value">{stats.followers}</div>
          <div className="stats-label">Followers</div>
        </div>
        <Link to="/orders" className="stats-card">
          <FiMessageSquare className="stats-icon text-purple-600" />
          <div className="stats-value">{stats.orders}</div>
          <div className="stats-label">Orders</div>
        </Link>
        <div className="stats-card">
          <FiStar className="stats-icon text-yellow-500" />
          <div className="stats-value">{stats.feedback}</div>
          <div className="stats-label">Rating</div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="dashboard-grid">
        <Link to="/minimart/add" className="dashboard-card">
          <FiPlus className="dashboard-icon" />
          <span className="dashboard-label">Add Product</span>
        </Link>
        <Link to="/orders" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#10b981,#14b8a6)'}}>
          <FiUsers className="dashboard-icon" />
          <span className="dashboard-label">Orders</span>
        </Link>
        <Link to="/conversations" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#8b5cf6,#a78bfa)'}}>
          <FiMessageSquare className="dashboard-icon" />
          <span className="dashboard-label">Messages</span>
        </Link>
        <Link to="/settings" className="dashboard-card" style={{background:'linear-gradient(to bottom right,#f59e0b,#fbbf24)'}}>
          <FiSettings className="dashboard-icon" />
          <span className="dashboard-label">Settings</span>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;