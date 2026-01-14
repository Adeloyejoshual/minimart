import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      setProducts(
        snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
          .filter(p => p.status === "active")
      );
    };
    fetchProducts();
  }, []);

  return (
    <div>
      <h1>MiniMart Products</h1>
      {products.map((p) => (
        <div key={p.id} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc" }}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
          {p.media.includes("video") ? (
            <video src={p.media} controls width="300" />
          ) : (
            <img src={p.media} width="300" alt={p.title} />
          )}
        </div>
      ))}
    </div>
  );
}