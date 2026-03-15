// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!user) return;

    axios
      .get(`${API}/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setProfile(res.data))
      .catch((err) => console.error(err));
  }, [user]);

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h2>Please login to view your profile</h2>
      </div>
    );
  }

  if (!profile) {
    return <p>Loading profile...</p>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>{profile.name}</h1>
      <p>Email: {profile.email}</p>
      <p>Phone: {profile.phone_number}</p>
      <p>
        Location: {profile.city}, {profile.state}, {profile.country}
      </p>
    </div>
  );
}