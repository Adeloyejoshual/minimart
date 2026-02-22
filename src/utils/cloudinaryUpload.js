// src/utils/cloudinaryUpload.js
export const uploadImages = async (files) => {
  if (!files || files.length === 0) return [];

  const uploadedImages = [];

  for (const file of files) {
    try {
      console.log("Uploading file:", file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
      );

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (data.error) {
        console.error("Cloudinary error:", data.error);
        alert(`Failed to upload ${file.name}: ${data.error.message}`);
        continue;
      }

      uploadedImages.push({
        url: data.secure_url,
        public_id: data.public_id,
      });

      console.log("Uploaded successfully:", data.secure_url);
    } catch (err) {
      console.error("Upload failed:", err);
      alert(`Failed to upload ${file.name}. Check console for details.`);
    }
  }

  return uploadedImages;
};
