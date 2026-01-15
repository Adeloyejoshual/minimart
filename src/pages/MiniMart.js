import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import TopNav from "../components/TopNav";
import { useNavigate } from "react-router-dom";

export default function MiniMart() {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

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

      <button onClick={() => navigate("/add-product?market=minimart")}>
        Add Product
      </button>

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