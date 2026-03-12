import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const Homepage = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get("/api/marketplace").then((res) => setProducts(res.data.data));
  }, []);

  return (
    <div className="container">
      <h2>Marketplace</h2>
      <Link to="/add-product">Add New Product</Link>
      <div className="products">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            <img src={p.image_url || "/placeholder.png"} alt={p.title} />
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Homepage;