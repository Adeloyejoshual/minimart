// src/utils/multer.js
import multer from "multer";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 6,
  },
});

export { upload };