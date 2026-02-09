import React, { useState, useEffect } from "react";
import axios from "axios";

export default function MiniMartPage() {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ title: "", price: 0 });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/minimart/products");
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addProduct = async () => {
    try {
      await axios.post("/api/minimart/products", newProduct);
      setNewProduct({ title: "", price: 0 });
      fetchProducts();
    } catch (err) {
      console.error("Failed to add MiniMart product:", err);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Products</h1>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.title} - ${p.price}
          </li>
        ))}
      </ul>

      <h2>Add Product</h2>
      <input
        placeholder="Title"
        value={newProduct.title}
        onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
      />
      <input
        placeholder="Price"
        type="number"
        value={newProduct.price}
        onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
      />
      <button onClick={addProduct}>Add MiniMart Product</button>
    </div>
  );
}