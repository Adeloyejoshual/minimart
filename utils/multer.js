// src/utils/multer.js
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

/* ===================== STORAGE CONFIG ===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";

    // ensure folder exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);

    cb(null, `${uniqueId}${ext}`);
  },
});

/* ===================== FILE FILTER ===================== */
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only image files are allowed"), false);
  }

  cb(null, true);
};

/* ===================== MULTER CONFIG ===================== */
export const upload = multer({
  storage,

  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 6,
  },

  fileFilter,
});