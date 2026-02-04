import React from "react";
import { Link } from "react-router-dom";

function TopNav() {
  return (
    <nav style={styles.nav}>
      <h2 style={styles.logo}>MiniMart</h2>
      <div style={styles.links}>
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/marketplace" style={styles.link}>Marketplace</Link>
        <Link to="/cart" style={styles.link}>Cart</Link>
        <Link to="/add-product" style={styles.button}>Sell</Link>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 25px",
    background: "#0a66c2",
    color: "#fff",
  },
  logo: { margin: 0 },
  links: { display: "flex", gap: "15px", alignItems: "center" },
  link: { color: "#fff", textDecoration: "none" },
  button: {
    background: "#fff",
    color: "#0a66c2",
    padding: "6px 12px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

export default TopNav;