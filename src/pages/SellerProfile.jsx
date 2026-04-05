import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function SellerProfile() {
  const { id } = useParams();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        setLoading(true);

        // ✅ FIXED: correct endpoint + response shape
        const res = await axios.get(`${API_BASE}/api/sellerprofile/${id}`);
        setSeller(res.data);

        // ✅ FIXED: correct endpoint
        const prod = await axios.get(
          `${API_BASE}/api/sellerprofile/${id}/products`
        );
        setProducts(prod.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load seller profile");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchSeller();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (error) return <div style={{ padding: 20 }}>{error}</div>;
  if (!seller) return <div style={{ padding: 20 }}>Seller not found</div>;

  return (
    <div style={{ padding: 20 }}>
      {/* Seller Info */}
      <h1>{seller.store_name || seller.name}</h1>
      <p>{seller.email}</p>
      <p>{seller.store_description}</p>
      <p>Total Products: {seller.total_products}</p>

      {/* Products */}
      <h3>Products</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {products.length === 0 ? (
          <p>No products yet</p>
        ) : (
          products.map((p) => (
            <div key={p.id} style={{ border: "1px solid #eee", padding: 10 }}>
              <strong>{p.title}</strong> - ₦{p.price}
            </div>
          ))
        )}
      </div>
    </div>
  );
}