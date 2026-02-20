import express from "express";
import axios from "axios";
import User from "../models/User.js";

const router = express.Router();

// Sync Auth0 user after login
router.post("/login", async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ 
        success: false, 
        message: "Access token required" 
      });
    }

    // Verify token with Auth0 (security)
    const response = await axios.get(
      `https://dev-akuuw0q85johcauu.us.auth0.com/userinfo`,
      {
        headers: { 
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        },
        timeout: 10000 // 10s timeout
      }
    );

    const { 
      sub: auth0Id, 
      name, 
      email, 
      email_verified, 
      picture,
      given_name,
      family_name
    } = response.data;

    // Validate essential fields
    if (!auth0Id || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid Auth0 user data" 
      });
    }

    // Upsert with full profile + timestamps
    const user = await User.findOneAndUpdate(
      { auth0Id },
      { 
        auth0Id,
        name: name || `${given_name || ''} ${family_name || ''}`.trim(),
        email,
        emailVerified: email_verified,
        picture,
        lastLogin: new Date(),
        updatedAt: new Date()
      },
      { 
        new: true, 
        upsert: true, 
        setDefaultsOnInsert: true,
        runValidators: true
      }
    );

    // Generate JWT or session token here (recommended)
    const token = generateToken(user); // Your JWT function

    res.json({ 
      success: true,
      user: {
        id: user._id,
        auth0Id: user.auth0Id,
        name: user.name,
        email: user.email,
        picture: user.picture
      },
      token 
    });

  } catch (err) {
    console.error("Auth login error:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    });

    // Handle Auth0-specific errors
    if (err.response?.status === 401) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server authentication error" 
    });
  }
});

// Generate JWT (add this helper)
function generateToken(user) {
  return jwt.sign(
    { id: user._id, auth0Id: user.auth0Id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export default router;