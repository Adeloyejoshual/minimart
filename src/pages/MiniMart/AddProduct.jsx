import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function AddMiniMartProduct() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      let imageUrl = null;

      // 1️⃣ Upload image to S3
      if (imageFile) {
        // Get a signed URL from your backend
        const { data: signedData } = await axios.post("/api/products/s3-sign", {
          fileName: imageFile.name,
          fileType: imageFile.type,
        });

        // Upload file directly to S3
        await axios.put(signedData.url, imageFile, {
          headers: { "Content-Type": imageFile.type },
        });

        imageUrl = signedData.key; // save the S3 key or full URL
      }

      // 2️⃣ Send product to backend
      await axios.post("/api/products", {
        title,
        description,
        price: parseFloat(price),
        category,
        stock: parseInt(stock),
        image: imageUrl,
      });

      alert("MiniMart product added successfully!");
      navigate("/");
    } catch (error) {
      console.error("Failed to add MiniMart product:", error);
      alert("Failed to add MiniMart product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Add MiniMart Product</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: "400px" }}>
        <input
          type="text"
          placeholder="Product Title"
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
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <br /><br />

        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <br /><br />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        />
        <br /><br />

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}
