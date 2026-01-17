// src/cloudinary.js
export async function uploadToCloudinary(file) {
  try {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      throw new Error("Cloudinary environment variables missing");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", preset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary error: ${res.status} ${text}`);
    }

    const data = await res.json();

    if (!data.secure_url) throw new Error("No secure_url returned by Cloudinary");

    return data.secure_url;
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    throw err; // throw so AddProduct knows upload failed
  }
}