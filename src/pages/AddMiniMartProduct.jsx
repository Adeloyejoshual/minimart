import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function AddMiniMartProduct() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      let imageUrl = null;

      // Upload to backend (which will save to S3)
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const uploadRes = await axios.post(
          "https://minimart-ivrm.onrender.com/api/marketplace/upload",
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        imageUrl = uploadRes.data.url; // S3 URL returned by backend
      }

      // Send product data to backend
      await axios.post("https://minimart-ivrm.onrender.com/api/marketplace/products", {
        title,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        image: imageUrl,
      });

      alert("MiniMart product added!");
      navigate("/");
    } catch (err) {
      console.error("Failed to add product:", err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "0 auto" }}>
      <h1>Add MiniMart Product</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <br /><br />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <br /><br />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <br /><br />

        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <br /><br />

        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
        <br /><br />

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}