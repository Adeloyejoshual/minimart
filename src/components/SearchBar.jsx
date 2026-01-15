// src/components/SearchBar.jsx
import { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form
      onSubmit={handleSearch}
      style={{
        display: "flex",
        marginBottom: 20,
        maxWidth: 500,
        margin: "0 auto",
        gap: 10,
      }}
    >
      <input
        type="text"
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          flex: 1,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />
      <button
        type="submit"
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          backgroundColor: "#0D6EFD",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}