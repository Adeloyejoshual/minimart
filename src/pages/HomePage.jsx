
// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../helpers/minimart";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const { isAuthenticated } = useAuth0();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const products = await getMiniMartProducts();
      setMiniMart(products);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="scrollable-content">
      <h1>MiniMart Store</h1>
      {isAuthenticated && (
        <Link to="/minimart/add">
          <button className="chat-btn">Add MiniMart Product</button>
        </Link>
      )}
      {miniMart.length === 0 && <p>No products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} className="product-card">
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              className="product-images"
            />
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}