import { useEffect, useState } from "react";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const API = "https://minimart-ivrm.onrender.com/api/admin/categories";

  // ---------------- LOAD ----------------
  const load = async () => {
    const res = await fetch(API);
    const data = await res.json();
    setCategories(data);
  };

  useEffect(() => {
    load();
  }, []);

  // ---------------- DELETE ----------------
  const remove = async (id) => {
    await fetch(`${API}/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin - Categories</h2>

      <button onClick={() => setEditing({ name: "", fields: [] })}>
        + Add Category
      </button>

      {categories.map((cat) => (
        <div key={cat.id} style={{ border: "1px solid #ddd", margin: 10, padding: 10 }}>
          <h3>{cat.name}</h3>

          <button onClick={() => setEditing(cat)}>Edit</button>
          <button onClick={() => remove(cat.id)}>Delete</button>
        </div>
      ))}

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