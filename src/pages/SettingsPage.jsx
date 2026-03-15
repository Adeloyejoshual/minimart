import { useState } from "react";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function Settings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notifications, setNotifications] = useState(true);

  const token = localStorage.getItem("token");

  const updateProfile = async () => {
    try {
      const res = await axios.put(
        `${API}/update`,
        { name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Profile updated");
    } catch (err) {
      alert("Error updating profile");
    }
  };

  const changePassword = async () => {
    try {
      await axios.put(
        `${API}/change-password`,
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Password changed");
    } catch {
      alert("Error changing password");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div style={{ maxWidth: "500px", margin: "auto", padding: "20px" }}>
      <h2>Settings</h2>

      <h3>Profile</h3>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button onClick={updateProfile}>Update Profile</button>

      <h3>Change Password</h3>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={changePassword}>Change Password</button>

      <h3>Notifications</h3>

      <label>
        <input
          type="checkbox"
          checked={notifications}
          onChange={() => setNotifications(!notifications)}
        />
        Enable Notifications
      </label>

      <br />
      <br />

      <button onClick={logout} style={{ background: "red", color: "white" }}>
        Logout
      </button>
    </div>
  );
}