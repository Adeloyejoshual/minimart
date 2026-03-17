// src/cloudinary.js
export async function uploadToCloudinary(file) {
  // 1️⃣ Get signed signature from backend
  const sigRes = await fetch("/api/cloudinary-signature"); // make sure your backend route matches
  if (!sigRes.ok) throw new Error("Failed to get Cloudinary signature");

  const { signature, timestamp, apiKey, cloudName } = await sigRes.json();

  // 2️⃣ Prepare FormData
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  // 3️⃣ Upload to Cloudinary
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Cloudinary upload failed");

  const data = await res.json();
  return data.secure_url;
}