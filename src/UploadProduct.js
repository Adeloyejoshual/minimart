import { useState } from "react";
import axios from "axios";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export default function UploadProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    setLoading(true);

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", "cxgzdaoh");

    const res = await axios.post(
      "https://api.cloudinary.com/v1_1/dq1znbmrk/auto/upload",
      form
    );

    const url = res.data.secure_url;

    await addDoc(collection(db, "products"), {
      title,
      price,
      media: url,
      created: Date.now()
    });

    setLoading(false);
    alert("Product uploaded!");
  };

  return (
    <div>
      <h2>Upload Product</h2>
      <input placeholder="Title" onChange={e => setTitle(e.target.value)} />
      <input placeholder="Price" onChange={e => setPrice(e.target.value)} />
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={upload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}