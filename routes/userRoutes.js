import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Sync Auth0 user
router.post("/sync", async (req, res) => {
  try {
    const { auth0Id, name, email, picture } = req.body;

    let user = await User.findOne({ auth0Id });
    if (!user) {
      user = await User.create({ auth0Id, name, email, picture });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;