import { useEffect, useState } from "react";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE}/homepage`, {
          headers: { Accept: "application/json" },
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed");

        setProducts(data.latest || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ================= UI ================= */

  return (
    <div style={styles.page}>
      <h1 style={styles.header}>MiniMart</h1>

      {loading && <p style={styles.text}>Loading products...</p>}

      {error && <p style={{ ...styles.text, color: "red" }}>{error}</p>}

      <div style={styles.grid}>
        {products.map((p) => (
          <div key={p.id} style={styles.card}>
            <img
              src={p.images?.[0] || "https://via.placeholder.com/300"}
              alt={p.title}
              style={styles.image}
            />

            <div style={styles.body}>
              <h3 style={styles.title}>
                {p.title?.length > 40
                  ? p.title.slice(0, 40) + "..."
                  : p.title}
              </h3>

              <p style={styles.price}>₦{Number(p.price).toLocaleString()}</p>

              <p style={styles.location}>
                📍 {p.location_city}, {p.location_state}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= SIMPLE STYLES ================= */

const styles = {
  page: {
    padding: "15px",
    fontFamily: "Arial",
    background: "#f6f6f6",
    minHeight: "100vh",
  },

  header: {
    textAlign: "center",
    marginBottom: "15px",
  },

  text: {
    textAlign: "center",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "10px",
  },

  card: {
    background: "#fff",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    cursor: "pointer",
  },

  image: {
    width: "100%",
    height: "120px",
    objectFit: "cover",
  },

  body: {
    padding: "10px",
  },

  title: {
    fontSize: "14px",
    margin: "0 0 5px",
  },

  price: {
    fontWeight: "bold",
    margin: "0 0 5px",
  },

  location: {
    fontSize: "12px",
    color: "#555",
  },
};