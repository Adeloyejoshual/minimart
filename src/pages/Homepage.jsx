import React from "react";

export default function Home() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>MyApp</h1>
        <nav>
          <a href="#" style={styles.link}>Home</a>
          <a href="#" style={styles.link}>Products</a>
          <a href="#" style={styles.link}>Contact</a>
        </nav>
      </header>

      <main style={styles.main}>
        <h2>Welcome to My Marketplace</h2>
        <p>Buy and sell products easily.</p>
        <button style={styles.button}>Get Started</button>
      </main>

      <footer style={styles.footer}>
        <p>© 2026 MyApp. All rights reserved.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    padding: "15px 30px",
    background: "#111",
    color: "#fff",
  },
  logo: {
    margin: 0,
  },
  link: {
    color: "#fff",
    marginLeft: "15px",
    textDecoration: "none",
  },
  main: {
    textAlign: "center",
    padding: "80px 20px",
  },
  button: {
    marginTop: "20px",
    padding: "10px 20px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  footer: {
    textAlign: "center",
    padding: "20px",
    background: "#f5f5f5",
  },
};