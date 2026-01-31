import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

function ManagerDashboard() {
  const [sellers, setSellers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/sellers`, {
        params: { search, page, limit }
      });
      setSellers(res.data.sellers);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to fetch sellers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, [search, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🛒 Manager Dashboard</h1>

      <input
        type="text"
        placeholder="Search sellers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: "0.5rem", width: "300px", marginBottom: "1rem" }}
      />

      {loading ? (
        <p>Loading sellers...</p>
      ) : sellers.length === 0 ? (
        <p>No sellers found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: "0.5rem" }}>Name</th>
              <th style={{ border: "1px solid #ddd", padding: "0.5rem" }}>Email</th>
              <th style={{ border: "1px solid #ddd", padding: "0.5rem" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map(s => (
              <tr key={s.id || s._id}>
                <td style={{ border: "1px solid #ddd", padding: "0.5rem" }}>
                  {s.name || s.storeName}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "0.5rem" }}>
                  {s.email || "-"}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "0.5rem" }}>
                  {s.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: "1rem" }}>
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            Prev
          </button>
          <span style={{ margin: "0 1rem" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ManagerDashboard;