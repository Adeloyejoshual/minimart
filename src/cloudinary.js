// src/cloudinary.js
export const uploadToCloudinary = async (file) => {
  if (!file) throw new Error("No file selected");

  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_NAME}/image/upload`,
      { method: "POST", body: data }
    );
    const json = await res.json();

    if (!json.secure_url) throw new Error("Failed to upload image to Cloudinary");
    return json.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    throw err;
  }
};