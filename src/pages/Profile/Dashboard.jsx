import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FiShoppingBag,
  FiPackage,
  FiEye,
  FiStar,
  FiAward,
  FiTrendingUp,
} from "react-icons/fi";
import "../../style/Profile.css";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/dashboard/overview", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Handle nested structure from new API
        setData(res.data.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;
  if (error || !data) return <div className="dashboard-error">{error || "No data"}</div>;

  return (
    <div className="dashboard-section p-6 space-y-8">
      
      {/* KPI CARDS - Matches new API exactly */}
      <div className="stats-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="stats-card bg-gradient-to-r from-blue-500 to-blue-600">
          <FiPackage />
          <h3>{data.listings.products}</h3>
          <p>Active Products</p>
        </div>

        <div className="stats-card bg-gradient-to-r from-green-500 to-green-600">
          <FiEye />
          <h3>{data.listings.views.toLocaleString()}</h3>
          <p>Total Views</p>
        </div>

        <div className="stats-card bg-gradient-to-r from-purple-500 to-purple-600">
          <FiTrendingUp />
          <h3>{data.engagement.ctr}%</h3>
          <p>Click Rate</p>
        </div>

        <div className="stats-card bg-gradient-to-r from-yellow-500 to-yellow-600">
          <FiAward />
          <h3>{data.sellerScore}</h3>
          <p>Seller Score</p>
        </div>

        <div className="stats-card bg-gradient-to-r from-indigo-500 to-indigo-600">
          <FiStar />
          <h3>{data.trust.rating?.toFixed(1) || 0}</h3>
          <p>Rating</p>
        </div>
      </div>

      {/* BUSINESS INSIGHTS */}
      <div className="dashboard-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="dashboard-card">
          <h4>Total Revenue</h4>
          <h2>₦{data.business.totalSales?.toLocaleString() || 0}</h2>
        </div>

        <div className="dashboard-card">
          <h4>Avg Response</h4>
          <h2>{data.responseHours?.toFixed(1)}h</h2>
        </div>

        <div className="dashboard-card">
          <h4>Verified Store</h4>
          <h2>{data.trust.verified ? '✅ Yes' : '❌ No'}</h2>
        </div>

        <div className="dashboard-card">
          <h4>Trust Level</h4>
          <h2>{data.trust.trustScore || 50}</h2>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;