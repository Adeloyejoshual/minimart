import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [newProduct, setNewProduct] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    type: "",
    brand: "",
    condition: "",
    location: "",
  });

  // Fetch MiniMart products
  useEffect(() => {
    fetchMiniMart();
  }, []);

  const fetchMiniMart = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMart(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const addProduct = async () => {
    try {
      await axios.post("/api/minimart/products", newProduct);
      setNewProduct({
        title: "",
        description: "",
        price: "",
        category: "",
        type: "",
        brand: "",
        condition: "",
        location: "",
      });
      fetchMiniMart();
    } catch (err) {
      console.error("Add product error:", err);
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>MiniMart Store</h1>

      {/* Add product form */}
      <div style={{ marginBottom: "2rem" }}>
        <h2>Add Product</h2>
        <input
          placeholder="Title"
          value={newProduct.title}
          onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
        />
        <input
          placeholder="Description"
          value={newProduct.description}
          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
        />
        <input
          placeholder="Price (₦)"
          type="number"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
        />
        <input
          placeholder="Category"
          value={newProduct.category}
          onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
        />
        <input
          placeholder="Type"
          value={newProduct.type}
          onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
        />
        <input
          placeholder="Brand"
          value={newProduct.brand}
          onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
        />
        <input
          placeholder="Condition"
          value={newProduct.condition}
          onChange={(e) => setNewProduct({ ...newProduct, condition: e.target.value })}
        />
        <input
          placeholder="Location"
          value={newProduct.location}
          onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })}
        />
        <button onClick={addProduct}>Add MiniMart Product</button>
      </div>

      {/* Display MiniMart products */}
      {miniMart.map((p) => (
        <div key={p.id} style={{ borderBottom: "1px solid #ccc", marginBottom: "1rem" }}>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <p>₦{p.price}</p>
          <p>{p.category} | {p.type} | {p.brand} | {p.condition} | {p.location}</p>
        </div>
      ))}
    </div>
  );
}