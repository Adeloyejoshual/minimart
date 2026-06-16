import { useEffect, useState } from "react";

const API = `${import.meta.env.VITE_API_BASE_URL}/api/admin/categories`;

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  // ---------------- LOAD ----------------
  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
      setError("Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---------------- DELETE ----------------
  const remove = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;

    try {
      const res = await fetch(`${API}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      load();
    } catch (err) {
      console.error("Failed to delete category:", err);
      alert("Failed to delete category. Please try again.");
    }
  };

  // ---------------- RENDER ----------------
  return (
    <div style={{ padding: 20 }}>
      <h2>Admin - Categories</h2>

      <button
        onClick={() => setEditing({ name: "", fields: [] })}
        style={{ marginBottom: 20, padding: "10px 16px" }}
      >
        + Add Category
      </button>

      {/* Error Message */}
      {error && (
        <p style={{ color: "red", marginBottom: 12 }}>{error}</p>
      )}

      {/* Loading State */}
      {loading && <p>Loading categories...</p>}

      {/* Empty State */}
      {!loading && !error && categories.length === 0 && (
        <p>No categories found.</p>
      )}

      {/* Categories List */}
      {!loading && !error && categories.map((cat) => (
        <div
          key={cat.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            margin: "10px 0",
            padding: 16,
            backgroundColor: "#fafafa",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0" }}>{cat.name}</h3>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setEditing(cat)}>
              Edit
            </button>
            <button
              onClick={() => remove(cat.id)}
              style={{
                backgroundColor: "#e74c3c",
                color: "white",
                border: "none",
                borderRadius: 4,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* Editor Modal */}
      {editing && (
        <CategoryEditor
          category={editing}
          onClose={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}