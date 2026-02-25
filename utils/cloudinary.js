// utils/cloudinary.js
export const uploadImagesToCloudinary = async (files) => {
  const uploadPromises = files.map(file =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      
      fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(resolve)
      .catch(reject);
    })
  );
  return Promise.all(uploadPromises);
};