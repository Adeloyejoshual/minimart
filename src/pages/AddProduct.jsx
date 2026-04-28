import { useState } from "react";

export default function AddProduct() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category_id: "",
    location_state: "",
    location_city: "",
  });
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("Submitting...");

    const token = localStorage.getItem("token");

    const data = new FormData();
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("price", formData.price);
    data.append("category_id", formData.category_id);
    data.append("location_state", formData.location_state);
    data.append("location_city", formData.location_city);

    images.forEach((file) => data.append("images", file));

    try {
      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: data,
        }
      );

      const text = await res.text();
      console.log("status:", res.status);
      console.log("response:", text);

      if (!res.ok) throw new Error(text);

      const result = JSON.parse(text);
      setMessage("Product added successfully");
      console.log(result);
    } catch (err) {
      setMessage(err.message);
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: "20px auto" }}>
      <input name="title" placeholder="Title" value={formData.title} onChange={handleChange} />
      <br />
      <textarea
        name="description"
        placeholder="Description"
        value={formData.description}
        onChange={handleChange}
      />
      <br />
      <input name="price" placeholder="Price" value={formData.price} onChange={handleChange} />
      <br />
      <input
        name="category_id"
        placeholder="Category ID"
        value={formData.category_id}
        onChange={handleChange}
      />
      <br />
      <input
        name="location_state"
        placeholder="State"
        value={formData.location_state}
        onChange={handleChange}
      />
      <br />
      <input
        name="location_city"
        placeholder="City"
        value={formData.location_city}
        onChange={handleChange}
      />
      <br />
      <input type="file" multiple onChange={handleFileChange} />
      <br />
      <button type="submit">Add Product</button>
      <p>{message}</p>
    </form>
  );
}