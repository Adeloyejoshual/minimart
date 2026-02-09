import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function HomePage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get("/api/products").then((res) => setProducts(res.data));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Marketplace Products</h1>
      <Link to="/marketplace/add-product">Add Product</Link>
      <ul>
        {products.map((p) => (
          <li key={p._id} style={{ margin: "1rem 0" }}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p>Price: ${p.price}</p>
            {p.images?.length > 0 &&
              p.images.map((img, i) => (
                <img key={i} src={img} alt={p.name} width={100} style={{ marginRight: "0.5rem" }} />
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}