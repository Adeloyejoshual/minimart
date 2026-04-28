// upload.utils.js
import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";

export const uploadOne = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: "products",
    resource_type: "image",
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto" },
      { fetch_format: "auto" },
    ],
  });

  await fs.unlink(filePath).catch(() => {});
  return { url: result.secure_url, public_id: result.public_id };
};