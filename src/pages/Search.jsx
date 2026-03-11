import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      const { data } = await axios.get(
        `/api/marketplace/search?query=${encodeURIComponent(query)}`
      );
      setResults(data);
    } catch (err) {
      console.error("Search error:", err);
      alert("Failed to search products");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px" }}>
      <h2>Search Products</h2>

      <form onSubmit={handleSearch} style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search by product name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "8px", width: "70%" }}
        />
        <button type="submit" style={{ padding: "8px 16px", marginLeft: "8px" }}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
        {results.map((p) => (
          <Link
            key={p.id}
            to={`/minimart/${p.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#f8fafd",
              borderRadius: "12px",
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
              padding: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <img
              src={p.image_url || "/placeholder.png"}
              alt={p.title}
              style={{ width: "100%", height: "150px", objectFit: "cover" }}
            />
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "8px 0" }}>{p.title}</h3>
            <p style={{ fontWeight: 700, color: "#0D6EFD" }}>₦{p.price}</p>
          </Link>
        ))}
        {results.length === 0 && !loading && <p>No results found.</p>}
      </div>
    </div>
  );
}