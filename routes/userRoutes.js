import express from "express";
import axios from "axios";
import User from "../models/User.js";

const router = express.Router();

// Sync Auth0 user after login
router.post("/login", async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ message: "Access token required" });

    // Get user info from Auth0
    const response = await axios.get("https://dev-akuuw0q85johcauu.us.auth0.com/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub: auth0Id, name, email, picture } = response.data;

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { auth0Id },
      { name, email, picture },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(user);
  } catch (err) {
    console.error("Auth login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;