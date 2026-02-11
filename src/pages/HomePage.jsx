import { useEffect, useState } from "react";
import axios from "axios";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", price: 0, category: "" });
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    axios.get("/api/minimart/products").then(res => setMiniMart(res.data));
  }, []);

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
  });

  const handleAddProduct = async () => {
    let imageBase64 = null;
    if (imageFile) imageBase64 = await toBase64(imageFile);

    const res = await axios.post("/api/minimart/products", { ...newProduct, imageBase64 });
    setMiniMart([res.data, ...miniMart]);
    setNewProduct({ title: "", description: "", price: 0, category: "" });
    setImageFile(null);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>MiniMart Store</h1>

      <input type="text" placeholder="Title" value={newProduct.title} onChange={e => setNewProduct({ ...newProduct, title: e.target.value })} />
      <input type="text" placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
      <input type="number" placeholder="Price" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })} />
      <input type="text" placeholder="Category" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} />
      <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
      <button onClick={handleAddProduct}>Add Product</button>

      <div style={{ marginTop: "2rem" }}>
        {miniMart.map(p => (
          <div key={p.id} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
            {p.image_url && <img src={p.image_url} alt={p.title} style={{ maxWidth: "200px" }} />}
            <p>{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}