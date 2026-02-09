import { useState } from "react";
import axios from "axios";

function MarketplaceAddProductPage({ user }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    images: [],
  });
  const [products, setProducts] = useState([]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "images") {
      setFormData({ ...formData, images: Array.from(files) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace/products");
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("price", formData.price);
    data.append("userEmail", user.email);

    formData.images.forEach((file) => data.append("images", file));

    try {
      await axios.post("/api/marketplace/products", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Product added!");
      setFormData({ title: "", description: "", price: "", images: [] });
      fetchProducts(); // reload products
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    }
  };

  return (
    <div>
      <h2>Add Marketplace Product</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
          required
        />
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="price"
          placeholder="Price"
          value={formData.price}
          onChange={handleChange}
          required
        />
        <input
          type="file"
          name="images"
          multiple
          onChange={handleChange}
        />
        <button type="submit">Add Product</button>
      </form>

      <h3>Products</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
        {products.map((product) => (
          <div
            key={product._id}
            style={{
              border: "1px solid #ccc",
              padding: "8px",
              width: "200px",
            }}
          >
            {product.images[0] && (
              <img
                src={product.images[0]}
                alt={product.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
            )}
            <h4>{product.title}</h4>
            <p>${product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarketplaceAddProductPage;