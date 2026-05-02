// Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FiShoppingCart,
  FiBox,
  FiMessageSquare,
  FiStar,
} from "react-icons/fi";
import "../../style/Profile.css";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get("/api/dashboard/overview", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="dashboard-error">Failed to load dashboard</div>;
  }

  return (
    <div className="dashboard-section p-6">

      {/* KPI CARDS */}
      <div className="stats-grid">
        <div className="stats-card">
          <FiShoppingCart />
          <h3>{data.sales.orders}</h3>
          <p>Orders</p>
        </div>

        <div className="stats-card">
          <FiBox />
          <h3>{data.listings.products}</h3>
          <p>Products</p>
        </div>

        <div className="stats-card">
          <FiMessageSquare />
          <h3>{data.engagement.messages}</h3>
          <p>Messages</p>
        </div>

        <div className="stats-card">
          <FiStar />
          <h3>{data.trust.rating}</h3>
          <p>Rating</p>
        </div>
      </div>

      {/* INSIGHTS */}
      <div className="dashboard-grid">

        <div className="dashboard-card">
          <h4>Revenue</h4>
          <h2>₦{data.sales.revenue}</h2>
        </div>

        <div className="dashboard-card">
          <h4>Conversion Rate</h4>
          <h2>{data.sales.conversionRate}%</h2>
        </div>

        <div className="dashboard-card">
          <h4>Active Listings</h4>
          <h2>{data.listings.active}</h2>
        </div>

        <div className="dashboard-card">
          <h4>Seller Score</h4>
          <h2>{data.trust.sellerScore}</h2>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;