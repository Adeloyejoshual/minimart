import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function SellerProfile() {
  const { id } = useParams();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/users/${id}`);
        setSeller(res.data.user);

        const prod = await axios.get(
          `${API_BASE}/api/products?seller_id=${id}`
        );
        setProducts(prod.data.products || []);
      } catch (err) {
        console.error(err);
      }
    };

    if (id) fetchSeller();
  }, [id]);

  if (!seller) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>{seller.name}</h1>
      <p>{seller.email}</p>

      <h3>Products</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: "1px solid #eee", padding: 10 }}>
            {p.title} - ₦{p.price}
          </div>
        ))}
      </div>
    </div>
  );
}