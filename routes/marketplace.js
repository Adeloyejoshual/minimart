import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// -------------------
// S3 Client
// -------------------
const s3 = new S3Client({
  region: process.env.AWS_REGION, // eu-north-1
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// -------------------
// Multer setup (in-memory)
// -------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// -------------------
// Add Product Image Route
// -------------------
router.post("/add-product-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    // Generate unique filename
    const fileExtension = req.file.originalname.split(".").pop();
    const fileName = `products/${crypto.randomBytes(16).toString("hex")}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read", // So you can access it via URL
    });

    await s3.send(command);

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("S3 Upload Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;