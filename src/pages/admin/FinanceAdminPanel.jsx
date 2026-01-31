import { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function FinanceAdminPanel() {
  const [dashboard, setDashboard] = useState({ payouts: [], refunds: [], revenueTrend: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ---------------- Load Dashboard Data ----------------
  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const res = await axios.get("/api/admin/finance");
        setDashboard(res.data);
      } catch (err) {
        console.error("Failed to load finance data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading finance dashboard...</p>;

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <h2>Finance Admin Dashboard</h2>

      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ padding: 6, margin: "10px 0", width: "100%", borderRadius: 4, border: "1px solid #ccc" }}
      />

      <div style={{ maxWidth: 600, marginBottom: 20 }}>
        <Line
          data={{
            labels: dashboard.revenueTrend.map(r => r.date || ""),
            datasets: [
              {
                label: "Revenue",
                data: dashboard.revenueTrend.map(r => r.amount || 0),
                borderColor: "#198754",
                backgroundColor: "rgba(25,135,84,0.2)",
              },
            ],
          }}
        />
      </div>

      {/* Payouts Table */}
      <h3>Payouts</h3>
      <table border="1" cellPadding="6" style={{ marginTop: 10, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.payouts.map(p => (
            <tr key={p._id}>
              <td>{p.userId}</td>
              <td>₦{p.amount}</td>
              <td>{p.completed ? "Completed" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Refunds Table */}
      <h3>Refunds</h3>
      <table border="1" cellPadding="6" style={{ marginTop: 10, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.refunds.map(r => (
            <tr key={r._id}>
              <td>{r.userId}</td>
              <td>₦{r.amount}</td>
              <td>{r.completed ? "Completed" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}