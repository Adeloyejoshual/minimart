import React, { useState } from "react";
import axios from "axios";

export default function AddProduct() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!image) return alert("Select an image first!");
    setUploading(true);
    const formData = new FormData();
    formData.append("image", image);

    try {
      const { data } = await axios.post(
        "https://minimart-ivrm.onrender.com/api/marketplace/add-product-image",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setUrl(data.url);
      alert("Upload successful!");
    } catch (err) {
      console.error(err);
      alert("Upload failed. Check server logs.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4">
      <h2>Add Product Image</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="Preview" className="mt-2 w-48 h-48 object-cover" />}
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
      >
        {uploading ? "Uploading..." : "Upload Image"}
      </button>
      {url && (
        <div className="mt-2">
          <p>Image URL:</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700">
            {url}
          </a>
        </div>
      )}
    </div>
  );
}