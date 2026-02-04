import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "../../styles/homepage.css"; // reuse your CSS

const socket = io(import.meta.env.VITE_API_BASE_URL || "http://localhost:3000");

function AddProduct() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [isPromoted, setIsPromoted] = useState(false);
  const [isProSeller, setIsProSeller] = useState(false);

  const categories = ["Electronics", "Fashion", "Home", "Phones", "Beauty"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const product = {
      title,
      price: Number(price),
      location,
      images: [image],
      category,
      isPromoted,
      isProSeller,
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      if (res.ok) {
        const savedProduct = await res.json();
        socket.emit("newListing", savedProduct); // broadcast to homepage
        navigate("/"); // go back to homepage
      } else {
        console.error("Failed to add product");
      }
    } catch (err) {
      console.error("Error adding product:", err);
    }
  };

  return (
    <div className="homepage" style={{ paddingTop: "40px" }}>
      <div className="section" style={{ maxWidth: 600, margin: "0 auto" }}>
        <h2 className="section-title">Add New Product</h2>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <input
            className="search-input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            className="search-input"
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <input
            className="search-input"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <input
            className="search-input"
            placeholder="Image URL"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />

          <select
            className="search-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              checked={isPromoted}
              onChange={() => setIsPromoted(!isPromoted)}
            />{" "}
            Promote Product
          </label>

          <label>
            <input
              type="checkbox"
              checked={isProSeller}
              onChange={() => setIsProSeller(!isProSeller)}
            />{" "}
            Pro Seller
          </label>

          <button className="load-more-btn" type="submit">
            Submit Product
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddProduct;