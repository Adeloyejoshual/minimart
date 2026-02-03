import express from "express";
import { StreamChat } from "stream-chat";

const router = express.Router();
const serverClient = StreamChat.getInstance(
  process.env.VITE_STREAM_API_KEY,
  process.env.VITE_STREAM_SECRET_KEY
);

router.post("/token", async (req, res) => {
  try {
    const { userId, username } = req.body;
    const token = serverClient.createToken(userId);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate chat token" });
  }
});

export default router;