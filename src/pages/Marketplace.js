import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";

export default function Marketplace() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, "products"), where("marketType", "==", "marketplace"));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  return (
    <>
      <TopNav />

      <div style={{ background: "#fff3cd", padding: 10, marginBottom: 10 }}>
        ⚠️ Do NOT pay before delivery.  
        Always inspect the product before paying.  
        MiniMart is not responsible for Marketplace payments.
      </div>

      <h2>Marketplace</h2>

      {products.map(p => (
        <div key={p.id}>
          <img src={p.imageUrl} width="150" />
          <p>{p.name} - ₦{p.price}</p>
        </div>
      ))}
    </>
  );
}