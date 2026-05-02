import "../../style/Dashboard.css";  // ✅ Primary styles
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
// Removed "../../style/Profile.css" - Dashboard.css handles everything

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
      
      {/* KPI CARDS - Pure CSS gradients */}
      <div className="stats-grid">
        <div className="stats-card"> {/* Products - Blue */}
          <FiPackage />
          <h3>{data.listings.products}</h3>
          <p>Active Products</p>
        </div>

        <div className="stats-card"> {/* Views - Green */}
          <FiEye />
          <h3>{data.listings.views.toLocaleString()}</h3>
          <p>Total Views</p>
        </div>

        <div className="stats-card"> {/* CTR - Purple */}
          <FiTrendingUp />
          <h3>{data.engagement.ctr}%</h3>
          <p>Click Rate</p>
        </div>

        <div className="stats-card"> {/* Seller Score - Yellow */}
          <FiAward />
          <h3>{data.sellerScore}</h3>
          <p>Seller Score</p>
        </div>

        <div className="stats-card"> {/* Rating - Indigo */}
          <FiStar />
          <h3>{data.trust.rating?.toFixed(1) || 0}</h3>
          <p>Rating</p>
        </div>
      </div>

      {/* BUSINESS INSIGHTS */}
      <div className="dashboard-grid">
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