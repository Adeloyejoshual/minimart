import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", price: 0 });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/minimart");
      setMiniMart(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addProduct = async () => {
    try {
      await axios.post("/api/minimart", newProduct);
      setNewProduct({ title: "", description: "", price: 0 });
      fetchProducts();
    } catch (err) {
      console.error("Failed to add MiniMart product:", err.response?.data || err.message);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Products</h1>
      {miniMart.map(p => (
        <div key={p.id}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
          <p>{p.description}</p>
        </div>
      ))}

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
        type="number"
        placeholder="Price"
        value={newProduct.price}
        onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
      />
      <button onClick={addProduct}>Add MiniMart Product</button>
    </div>
  );
}