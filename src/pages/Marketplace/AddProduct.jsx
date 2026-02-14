import { useState } from "react";
import axios from "axios";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("price", price);
      if (image) formData.append("image", image);

      await axios.post("/api/marketplace", formData);
      alert("Product added!");
      setTitle(""); setDescription(""); setPrice(""); setImage(null); setPreview(null);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Title*" value={title} onChange={e => setTitle(e.target.value)} required />
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
      <input placeholder="Price*" type="number" value={price} onChange={e => setPrice(e.target.value)} required />
      <input type="file" accept="image/*" onChange={e => { setImage(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); }} />
      {preview && <img src={preview} alt="Preview" style={{ width: 150, margin: "8px 0" }} />}
      <button type="submit">Add Product</button>
    </form>
  );
}