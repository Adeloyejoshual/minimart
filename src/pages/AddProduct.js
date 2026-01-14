import { useState } from "react";
import { auth, db } from "../firebase";
import { addDoc, collection } from "firebase/firestore";
import { uploadToCloudinary } from "../cloudinary";

export default function AddProduct() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState(null);

  const upload = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("Login first");

      const imageUrl = await uploadToCloudinary(image);

      await addDoc(collection(db, "products"), {
        title,
        price,
        image: imageUrl,
        ownerId: user.uid,
        createdAt: new Date(),
        status: "active"
      });

      alert("Product uploaded");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h2>Post Product</h2>
      <input placeholder="Product title" onChange={e => setTitle(e.target.value)} />
      <input placeholder="Price" onChange={e => setPrice(e.target.value)} />
      <input type="file" onChange={e => setImage(e.target.files[0])} />
      <button onClick={upload}>Upload</button>
    </div>
  );
}