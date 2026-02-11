import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [newMiniMartProduct, setNewMiniMartProduct] = useState({
    title: "",
    description: "",
    price: 0,
    category: ""
  });
  const [error, setError] = useState("");

  const fetchMiniMart = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setMiniMart(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMiniMart();
  }, []);

  const handleAddMiniMart = async () => {
    try {
      const res = await axios.post("/api/minimart/products", newMiniMartProduct);
      // Add the new product to state so it shows immediately
      setMiniMart([res.data, ...miniMart]);
      setNewMiniMartProduct({ title: "", description: "", price: 0, category: "" });
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to add MiniMart product");
    }
  };

  return (
    <div>
      <h1>MiniMart Store</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input
        placeholder="Title"
        value={newMiniMartProduct.title}
        onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, title: e.target.value })}
      />
      <input
        placeholder="Description"
        value={newMiniMartProduct.description}
        onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, description: e.target.value })}
      />
      <input
        placeholder="Price"
        type="number"
        value={newMiniMartProduct.price}
        onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, price: e.target.value })}
      />
      <input
        placeholder="Category"
        value={newMiniMartProduct.category}
        onChange={(e) => setNewMiniMartProduct({ ...newMiniMartProduct, category: e.target.value })}
      />
      <button onClick={handleAddMiniMart}>Add MiniMart Product</button>

      <hr />
      {miniMart.map((p) => (
        <div key={p.id}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
          {p.description && <p>{p.description}</p>}
          {p.category && <p>Category: {p.category}</p>}
        </div>
      ))}
    </div>
  );
}