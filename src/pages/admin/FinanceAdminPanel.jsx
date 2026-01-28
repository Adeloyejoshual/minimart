// src/pages/admin/FinanceAdminPanel.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function FinanceAdminPanel() {
  const [dashboard, setDashboard] = useState({ payouts: [], refunds: [], revenueTrend: [] });
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Initialize Socket.IO
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("financeUpdate", () => loadDashboard());

    return () => s.disconnect();
  }, []);

  // Load Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/finance", { params: dateRange });
      setDashboard(res.data);
    } catch (err) {
      console.error("Failed to load finance dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  // Approve Payout
  const approvePayout = async (payoutId) => {
    try {
      const res = await axios.post(`/api/admin/finance/payout/${payoutId}/approve`);
      alert("✅ Payout approved");
      socket.emit("financeUpdate", res.data);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to approve payout");
    }
  };

  // Reject Refund
  const rejectRefund = async (refundId) => {
    try {
      const res = await axios.post(`/api/admin/finance/refund/${refundId}/reject`);
      alert("❌ Refund rejected");
      socket.emit("financeUpdate", res.data);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to reject refund");
    }
  };

  // --- Sorting & Searching ---
  const sortedData = (data) => {
    let filtered = data;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        d =>
          d.userId.toLowerCase().includes(term) ||
          d.amount.toString().includes(term) ||
          (d.completed ? "completed" : "pending").includes(term)
      );
    }

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === "string") return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        if (typeof aValue === "number") return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        return 0;
      });
    }

    return filtered;
  };

  // --- Export CSV ---
  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return alert("No data to export");

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(d => Object.values(d).map(v => `"${v}"`).join(",")).join("\n");
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2>Finance Admin Dashboard</h2>

      {/* Date Filter */}
      <div style={{ margin: "10px 0", display: "flex", gap: 10 }}>
        <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
        <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
        <button onClick={loadDashboard} style={{ padding: "6px 12px", background: "#4da6ff", color: "#fff", border: "none", borderRadius: 4 }}>
          Apply
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by User ID, Amount, Status..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ padding: 6, marginBottom: 12, width: "100%", borderRadius: 4, border: "1px solid #ccc" }}
      />

      {/* Revenue Chart */}
      <div style={{ maxWidth: 800, marginBottom: 30 }}>
        <Line
          data={{
            labels: dashboard.revenueTrend.map(r => r.date),
            datasets: [
              {
                label: "Revenue",
                data: dashboard.revenueTrend.map(r => r.amount),
                borderColor: "#198754",
                backgroundColor: "rgba(25,135,84,0.2)",
              },
            ],
          }}
        />
      </div>

      {loading ? (
        <p>Loading finance data...</p>
      ) : (
        <>
          {/* Payouts Table */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Payouts</h3>
            <button onClick={() => exportCSV(dashboard.payouts, "payouts.csv")} style={{ padding: 6, background: "#0d6efd", color: "#fff", borderRadius: 4 }}>
              Export CSV
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: 8 }}>User ID</th>
                <th style={{ padding: 8 }}>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedData(dashboard.payouts)?.map(p => (
                <tr key={p._id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{p.userId}</td>
                  <td>₦{p.amount}</td>
                  <td>{p.completed ? "Completed" : "Pending"}</td>
                  <td>
                    {!p.completed && (
                      <button onClick={() => approvePayout(p._id)} style={{ padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}>
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Refunds Table */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>Refunds</h3>
            <button onClick={() => exportCSV(dashboard.refunds, "refunds.csv")} style={{ padding: 6, background: "#0d6efd", color: "#fff", borderRadius: 4 }}>
              Export CSV
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: 8 }}>User ID</th>
                <th style={{ padding: 8 }}>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedData(dashboard.refunds)?.map(r => (
                <tr key={r._id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: 8 }}>{r.userId}</td>
                  <td>₦{r.amount}</td>
                  <td>{r.completed ? "Completed" : "Pending"}</td>
                  <td>
                    {!r.completed && (
                      <button onClick={() => rejectRefund(r._id)} style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}