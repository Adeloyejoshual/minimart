// src/cloudinary.js
export const uploadToCloudinary = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('upload_preset', 'your_upload_preset'); // Get from Cloudinary dashboard
  formData.append('cloud_name', 'your_cloud_name'); // Your cloud name

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/your_cloud_name/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();
  return data.secure_url;
};