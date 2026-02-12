import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const [product, setProduct] = useState({ title: "", price: 0 });
  const navigate = useNavigate();

  const addProduct = async () => {
    try {
      await axios.post("/api/minimart", product);
      alert("MiniMart product added!");
      navigate("/"); // Go back to homepage
    } catch {
      alert("Failed to add product");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add MiniMart Product</h1>
      <input
        placeholder="Title"
        value={product.title}
        onChange={e => setProduct({ ...product, title: e.target.value })}
      />
      <input
        placeholder="Price"
        type="number"
        value={product.price}
        onChange={e => setProduct({ ...product, price: e.target.value })}
      />
      <button onClick={addProduct}>Add Product</button>
    </div>
  );
}