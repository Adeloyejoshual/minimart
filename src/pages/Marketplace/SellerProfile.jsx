import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function SellerProfile() {
  const { sellerId } = useParams();
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    const fetchSeller = async () => {
      const res = await fetch(`/api/sellers/${sellerId}`);
      const data = await res.json();
      setSeller(data);
    };

    fetchSeller();
  }, [sellerId]);

  if (!seller) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto" }}>
      <h1>{seller.name}</h1>
      <p>{seller.email}</p>
      <p>Location: {seller.state}</p>

      <h2>Products</h2>

      <div style={{ display: "grid", gap: 20 }}>
        {seller.products.map((product) => (
          <Link key={product._id} to={`/marketplace/${product._id}`}>
            <div style={{ border: "1px solid #ddd", padding: 10 }}>
              {product.title}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}