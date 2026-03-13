// routes/marketplace.js
import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import path from "path";

dotenv.config();

const router = express.Router();

// Configure multer storage (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// AWS S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Route: AddProduct (image only)
router.post("/add-product", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const key = `products/${uuidv4()}${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read", // so users can access the image
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Return the public URL
    const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.status(200).json({
      message: "Product image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return res.status(500).json({ error: "Failed to upload image" });
  }
});

export default router;