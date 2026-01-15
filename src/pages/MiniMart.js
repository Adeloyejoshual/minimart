import { useEffect, useState } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import TopNav from "../components/TopNav";

export default function MiniMart() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");

  // Load MiniMart products
  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, "products"), where("marketType", "==", "minimart"));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  // Add new product
  const handleAddProduct = async () => {
    if (!name || !price || !description || !imageFile) return alert("Fill all fields");

    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("upload_preset", "cxgzdaoh"); // Cloudinary preset

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      const docRef = await addDoc(collection(db, "products"), {
        name,
        price: parseFloat(price),
        description,
        imageUrl: data.secure_url,
        ownerId: auth.currentUser.uid,
        marketType: "minimart",
        createdAt: serverTimestamp(),
      });

      setProducts(prev => [...prev, { id: docRef.id, name, price, description, imageUrl: data.secure_url }]);
      setMessage("Product added successfully!");
      setName(""); setPrice(""); setDescription(""); setImageFile(null);
    } catch (err) {
      console.error(err);
      alert("Error adding product: " + err.message);
    }
  };

  return (
    <>
      <TopNav />
      <h2>MiniMart (Verified Sellers)</h2>

      {/* Form to add new product */}
      <div style={{ border: "1px solid #ccc", padding: 10, marginBottom: 20 }}>
        <h3>Add New Product</h3>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} /><br/>
        <input placeholder="Price" type="number" value={price} onChange={e => setPrice(e.target.value)} /><br/>
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} /><br/>
        <input type="file" onChange={e => setImageFile(e.target.files[0])} /><br/>
        <button onClick={handleAddProduct}>Add Product</button>
        {message && <p>{message}</p>}
      </div>

      {/* Display products */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map(p => (
          <div key={p.id} style={{ border: "1px solid #ccc", padding: 10, width: 180 }}>
            <img src={p.imageUrl} width="150" />
            <p><b>{p.name}</b></p>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>
    </>
  );
}