// /services/uploadService.js

import { uploadToCloudinary } from "../cloudinary";

export const uploadImages = async (files) => {
  const uploads = files.map(file => uploadToCloudinary(file));
  return Promise.all(uploads);
};