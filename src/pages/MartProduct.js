import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function MartProduct() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  // Get logged-in Firebase user
  onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
    } else {
      navigate("/login");
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !price) {
      return alert("All fields are required");
    }

    if (!user) return alert("You must be logged in");

    try {
      setLoading(true);

      await axios.post(`${process.env.REACT_APP_API_URL}/api/mart-products`, {
        name: title,
        description,
        price,
        userId: user.uid,
        userEmail: user.email
      });

      alert("✅ Product added to MiniMart!");
      navigate("/minimart");
    } catch (err) {
      console.error("Add product error:", err);
      alert("❌ Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20 }}>
      <h2>Add Product to MiniMart</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          placeholder="Product Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: 10 }}
        />

        <textarea
          placeholder="Product Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: 10, minHeight: 100 }}
        />

        <input
          type="number"
          placeholder="Price (₦)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{ padding: 10 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            background: "#0d6efd",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}