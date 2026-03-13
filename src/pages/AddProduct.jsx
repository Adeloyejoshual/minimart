import React, { useState } from "react";
import axios from "axios";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState("");

  // Get logged-in user from localStorage
  const user = JSON.parse(localStorage.getItem("user"));

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price) {
      setMessage("Title and price are required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("seller_id", user?.id); // use logged-in user's ID
      if (image) formData.append("image", image);

      const response = await axios.post("/api/marketplace", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("Product added successfully!");
      setTitle("");
      setDescription("");
      setPrice("");
      setImage(null);
    } catch (err) {
      console.error(err);
      setMessage("Failed to add product");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto" }}>
      <h2>Add Product</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <div>
          <label>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label>Price:</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Image:</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <button type="submit">Add Product</button>
      </form>
    </div>
  );
}