import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";

export default function MiniMart() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, "products"), where("marketType", "==", "minimart"));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  return (
    <>
      <TopNav />
      <h2>MiniMart (Verified Sellers)</h2>

      {products.map(p => (
        <div key={p.id}>
          <img src={p.imageUrl} width="150" />
          <p>{p.name} - ₦{p.price}</p>
        </div>
      ))}
    </>
  );
}