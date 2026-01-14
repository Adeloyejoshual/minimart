import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  return (
    <div>
      <h2>MiniMart</h2>
      {products.map(p => (
        <div key={p.id}>
          <img src={p.image} width="200" />
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}