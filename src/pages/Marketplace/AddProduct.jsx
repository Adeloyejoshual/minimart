import axios from "axios";
import { useState } from "react";

export default function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    image: "",
  });

  const uploadImage = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
      data
    );

    return res.data.secure_url;
  };

  const handleSubmit = async () => {
    await axios.post("/api/marketplace/products", form);
    alert("Product added");
  };

  return (
    <div>
      <input placeholder="Title"
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />

      <input type="file"
        onChange={async (e) => {
          const url = await uploadImage(e.target.files[0]);
          setForm({ ...form, image: url });
        }}
      />

      <button onClick={handleSubmit}>Post Product</button>
    </div>
  );
}