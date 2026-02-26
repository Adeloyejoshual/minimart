// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ✅ Upload middleware for direct frontend uploads validation
export const uploadImage = (filePath) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        resource_type: 'auto',
        folder: 'marketplace/products',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit', quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        public_id: `product_${Date.now()}`
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    );
  });
};

// ✅ Verify uploaded image exists
export const verifyImage = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    throw new Error('Image not found or invalid');
  }
};

export default cloudinary;