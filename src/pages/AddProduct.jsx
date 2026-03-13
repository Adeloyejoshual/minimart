// AddProduct.jsx
import React, { useState } from "react";
import axios from "axios";

const AddProduct = () => {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
    setImageUrl("");
    setError("");
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!image) {
      setError("Please select an image first");
      return;
    }

    const formData = new FormData();
    formData.append("image", image);

    try {
      setUploading(true);
      setError("");
      setProgress(0);

      const res = await axios.post(
        "https://minimart-ivrm.onrender.com/api/marketplace/add-product",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percent);
          },
        }
      );

      setImageUrl(res.data.imageUrl);
    } catch (err) {
      console.error("Upload Error:", err.response || err.message);
      const msg =
        err.response?.data?.error ||
        "Failed to upload image. Check server logs or AWS credentials.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 border rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Add Product Image</h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        {uploading ? `Uploading ${progress}%` : "Upload Image"}
      </button>

      {progress > 0 && uploading && (
        <p className="mb-2">Progress: {progress}%</p>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {imageUrl && (
        <div className="mt-4">
          <p className="text-green-600 mb-2">Image uploaded successfully!</p>
          <img src={imageUrl} alt="Uploaded" className="w-full rounded" />
          <p className="text-sm mt-2 break-all">{imageUrl}</p>
        </div>
      )}
    </div>
  );
};

export default AddProduct;