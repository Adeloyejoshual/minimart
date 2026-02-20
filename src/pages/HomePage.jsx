// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../helpers/minimart";
import { getMarketplaceProducts } from "../helpers/marketplace";
import "./HomePage.css";

export default function HomePage() {
const [miniMart, setMiniMart] = useState([]);
const [marketplace, setMarketplace] = useState([]);
const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

useEffect(() => {
fetchProducts();
}, []);

const fetchProducts = async () => {
try {
const mini = await getMiniMartProducts();
const market = await getMarketplaceProducts();
setMiniMart(mini);
setMarketplace(market);
} catch (err) {
console.error("Failed to fetch products:", err);
}
};

return (
<div className="home-page" style={{ padding: "16px" }}>
{/* Sticky Header */}
<div
className="sticky-header"
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
}}
>
<h2 className="header-title">MiniMart Store</h2>
{isAuthenticated ? (
<button
className="chat-btn"
onClick={() => logout({ returnTo: window.location.origin })}
>
Logout
</button>
) : (
<button className="chat-btn" onClick={() => loginWithRedirect()}>
Login / Register
</button>
)}
</div>

{/* Navigation Cards */}  
  <div  
    className="home-navigation"  
    style={{ display: "flex", gap: "16px", margin: "16px 0" }}  
  >  
    <Link to="/marketplace" className="nav-card">  
      <div  
        style={{  
          padding: "20px",  
          borderRadius: "12px",  
          backgroundColor: "#0D6EFD",  
          color: "#fff",  
          flex: 1,  
          textAlign: "center",  
          fontWeight: "600",  
          cursor: "pointer",  
          transition: "0.2s",  
        }}  
      >  
        Marketplace  
      </div>  
    </Link>  

    <Link to="/minimart" className="nav-card">  
      <div  
        style={{  
          padding: "20px",  
          borderRadius: "12px",  
          backgroundColor: "#198754",  
          color: "#fff",  
          flex: 1,  
          textAlign: "center",  
          fontWeight: "600",  
          cursor: "pointer",  
          transition: "0.2s",  
        }}  
      >  
        MiniMart  
      </div>  
    </Link>  

    <Link to="/offers" className="nav-card">  
      <div  
        style={{  
          padding: "20px",  
          borderRadius: "12px",  
          backgroundColor: "#FFC107",  
          color: "#000",  
          flex: 1,  
          textAlign: "center",  
          fontWeight: "600",  
          cursor: "pointer",  
          transition: "0.2s",  
        }}  
      >  
        Offers  
      </div>  
    </Link>  
  </div>  

  {/* Add MiniMart Product */}  
  {isAuthenticated && (  
    <Link to="/minimart/add">  
      <button className="chat-btn full-width-btn">Add MiniMart Product</button>  
    </Link>  
  )}  

  {/* MiniMart Products */}  
  <h3 style={{ marginTop: "24px" }}>MiniMart Products</h3>  
  {miniMart.length === 0 && <p>No products yet.</p>}  
  <div className="products-grid">  
    {miniMart.map((p) => (  
      <Link key={p.id} to={`/minimart/${p.id}`} className="product-card">  
        <img  
          src={p.image_url || "/placeholder.png"}  
          alt={p.title}  
          className="grid-product-img"  
        />  
        <h3 className="product-title">{p.title}</h3>  
        <p className="product-price">₦{p.price}</p>  
      </Link>  
    ))}  
  </div>  

  {/* Add Marketplace Product */}  
  {isAuthenticated && (  
    <Link to="/marketplace/add">  
      <button className="chat-btn full-width-btn" style={{ marginTop: "16px" }}>  
        Add Marketplace Product  
      </button>  
    </Link>  
  )}  

  {/* Marketplace Products */}  
  <h3 style={{ marginTop: "24px" }}>Marketplace</h3>  
  {marketplace.length === 0 && <p>No products yet.</p>}  
  <div className="products-grid">  
    {marketplace.map((p) => (  
      <Link key={p._id} to={`/marketplace/${p._id}`} className="product-card">  
        <img  
          src={p.images?.[0] || "/placeholder.png"}  
          alt={p.title}  
          className="grid-product-img"  
        />  
        <h3 className="product-title">{p.title}</h3>  
        <p className="product-price">₦{p.price}</p>  
      </Link>  
    ))}  
  </div>  

  {/* Styles */}  
  <style>{`  
    .chat-btn {  
      background: #0D6EFD;  
      color: #fff;  
      padding: 12px;  
      border-radius: 12px;  
      font-weight: 600;  
      width: 100%;  
      font-size: 16px;  
      cursor: pointer;  
      border: none;  
      margin-top: 12px;  
      transition: 0.2s;  
    }  
    .chat-btn:hover { background: #0b5ed7; }  

    .products-grid {  
      display: grid;  
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));  
      gap: 16px;  
      margin-top: 12px;  
    }  

    .product-card {  
      text-decoration: none;  
      color: inherit;  
      border: 1px solid #eee;  
      border-radius: 12px;  
      overflow: hidden;  
      transition: 0.2s;  
    }  
    .product-card:hover {  
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);  
      transform: translateY(-2px);  
    }  

    .grid-product-img {  
      width: 100%;  
      height: 120px;  
      object-fit: cover;  
    }  

    .product-title {  
      font-size: 14px;  
      padding: 6px 8px 0;  
    }  

    .product-price {  
      font-weight: 600;  
      padding: 0 8px 8px;  
      color: #0D6EFD;  
    }  

    .home-navigation div:hover {  
      transform: translateY(-3px);  
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);  
    }  
  `}</style>  
</div>

);
}