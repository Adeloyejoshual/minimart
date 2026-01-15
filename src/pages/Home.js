// src/pages/Home.js
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(items);
      } catch (err) {
        alert("Error fetching products: " + err.message);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>MiniMart Products</h1>
      <button onClick={() => navigate("/add-product")}>Add New Product</button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "20px" }}>
        {products.length === 0 ? (
          <p>No products available.</p>
        ) : (
          products.map(product => (
            <div key={product.id} style={{ border: "1px solid #ccc", padding: "10px", width: "200px" }}>
              <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "150px", objectFit: "cover" }} />
              <h3>{product.name}</h3>
              <p>${product.price}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Home;