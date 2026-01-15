import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import TopNav from "../components/TopNav";
import { useNavigate } from "react-router-dom";

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

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
        ⚠️ Do NOT pay before delivery. Always inspect the product first.
      </div>

      <h2>Marketplace (Anyone Can Post)</h2>

      <button onClick={() => navigate("/add-product?market=marketplace")}>
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