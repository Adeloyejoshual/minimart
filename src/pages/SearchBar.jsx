import { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
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
          padding: "10px 15px",
          borderRadius: 5,
          border: "1px solid #ccc",
          fontSize: 16,
        }}
      />
      <button
        type="submit"
        style={{
          padding: "10px 20px",
          backgroundColor: "#0D6EFD",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Search
      </button>
    </form>
  );
}