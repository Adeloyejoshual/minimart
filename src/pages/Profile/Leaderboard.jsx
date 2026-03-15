// Page/Profile/Leaderboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import '../style/Profile.css';

const Leaderboard = () => {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Fetch leaderboard data
    const fetchLeaders = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/leaderboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLeaders(res.data);
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
      }
    };

    fetchLeaders();
  }, []);

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <div className="leaderboard-table bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="table-header grid grid-cols-5 p-4 bg-gray-100 font-semibold text-gray-700">
          <div>Rank</div>
          <div>Name</div>
          <div>Products</div>
          <div>Followers</div>
          <div>Rating</div>
        </div>
        <div className="table-body">
          {leaders.map((user, index) => (
            <div key={user.id} className="table-row grid grid-cols-5 p-4 border-b border-gray-100 hover:bg-indigo-50 transition-all cursor-pointer">
              <div>{index + 1}</div>
              <div>{user.name}</div>
              <div>{user.products}</div>
              <div>{user.followers}</div>
              <div>{user.feedback}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;