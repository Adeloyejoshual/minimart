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
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            setProgress(percent);
          },
        }
      );

      setImageUrl(res.data.imageUrl);
    } catch (err) {
      console.error("Upload Error:", err.response || err.message);

      // Display detailed AWS or server error in UI
      const awsError =
        err.response?.data?.details ||
        err.response?.data?.error ||
        err.message;

      setError(
        `Upload failed. Check AWS credentials, bucket policy, and CORS. Details: ${awsError}`
      );
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

      {uploading && progress > 0 && <p>Progress: {progress}%</p>}

      {error && <p className="text-red-500 mt-2">{error}</p>}

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