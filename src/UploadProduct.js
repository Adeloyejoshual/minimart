import { useState } from "react";
import axios from "axios";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export default function UploadProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const userId = "owner_joshua"; // placeholder for now

  const upload = async () => {
    if (!file || !title || !price) return alert("Fill all fields!");

    setLoading(true);

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/auto/upload`,
      form
    );

    const url = res.data.secure_url;

    await addDoc(collection(db, "products"), {
      title,
      price: Number(price),
      media: url,
      ownerId: userId,
      status: "active",
      created: Date.now()
    });

    setLoading(false);
    setTitle("");
    setPrice("");
    setFile(null);
    alert("Product uploaded!");
  };

  return (
    <div style={{ marginBottom: "30px" }}>
      <h2>Upload Product</h2>
      <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <input placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} />
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={upload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}