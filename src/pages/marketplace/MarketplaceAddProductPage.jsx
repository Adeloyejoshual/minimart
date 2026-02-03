// src/pages/marketplace/MarketplaceAddProductPage.jsx
import { useState } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export default function MarketplaceAddProductPage() {
  const { isAuthenticated, loginWithRedirect, user } = useAuth0();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return loginWithRedirect();

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price);
      if (image) formData.append("image", image);
      formData.append("userId", user.sub);

      await axios.post(`${import.meta.env.VITE_API_URL}/marketplace/listings`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("Product added successfully!");
      setTitle("");
      setDescription("");
      setPrice("");
      setImage(null);
    } catch (err) {
      console.error(err);
      setStatus("Failed to add product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Add Marketplace Product</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="border p-2 rounded"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="border p-2 rounded"
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="border p-2 rounded"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
          className="border p-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>

      {status && <p className="mt-4 text-green-600">{status}</p>}
    </div>
  );
}