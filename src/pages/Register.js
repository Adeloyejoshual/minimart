// src/pages/Register.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) return alert("Enter a valid email");
    if (password.length < 6) return alert("Password must be at least 6 characters");

    try {
      const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      // Add user document to Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        email: trimmedEmail,
        blocked: false,
        createdAt: new Date(),
      });

      navigate("/"); // redirect to Home after registration
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h2>Register</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password (min 6 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Register</button>
    </form>
  );
};

export default Register;