import React, { useState } from "react";
import axios from "axios";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post("/api/auth/signup", form);
      setVerificationPending(true);
      setMessage("✅ Registered! Check your email for verification.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Signup failed");
    }
  };

  const resendVerification = async () => {
    try {
      await axios.post("/api/auth/resend-verification", { email: form.email });
      setMessage("✅ Verification email resent! Check your inbox.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to resend verification email");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h2>Signup</h2>
      {message && <p>{message}</p>}
      {!verificationPending ? (
        <form onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Name" onChange={handleChange} required />
          <input type="email" name="email" placeholder="Email" onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
          <button type="submit">Sign Up</button>
        </form>
      ) : (
        <button onClick={resendVerification}>Resend Verification Email</button>
      )}
    </div>
  );
}