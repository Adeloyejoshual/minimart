// routes/upload.js
import express from "express";
import crypto from "crypto";

const router = express.Router();

router.get("/signature", (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);

  const paramsToSign = `timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;

  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign)
    .digest("hex");

  res.json({
    timestamp,
    signature,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
});

export default router;