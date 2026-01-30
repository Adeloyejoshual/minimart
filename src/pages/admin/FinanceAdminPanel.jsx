// src/pages/admin/FinanceAdminPanel.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function FinanceAdminPanel() {
  const [dashboard, setDashboard] = useState({ payouts: [], refunds: [], revenueTrend: [] });
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // --- Initialize Socket.IO for real-time updates ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("financeUpdate", () => loadDashboard());

    return () => s.disconnect();
  }, []);

  // --- Load dashboard data ---
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

  // --- Approve Payout ---
  const approvePayout = async (payoutId) => {
    try {
      await axios.post(`/api/admin/finance/payout/${payoutId}/approve`);
      socket.emit("financeUpdate");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to approve payout");
    }
  };

  // --- Reject Refund ---
  const rejectRefund = async (refundId) => {
    try {
      await axios.post(`/api/admin/finance/refund/${refundId}/reject`);
      socket.emit("financeUpdate");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to reject refund");
    }
  };

  // --- Filter & Sort Data ---
  const filteredAndSorted = (data) => {
    let result = data;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        d =>
          d.userId.toLowerCase().includes(term) ||
          d.amount.toString().includes(term) ||
          (d.completed ? "completed" : "pending").includes(term)
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "string") return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        if (typeof aVal === "number") return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        return 0;
      });
    }

    return result;
  };

  // --- Export CSV ---
  const exportCSV = (data, filename) => {
    if (!data || !data.length) return alert("No data to export");
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(d => Object.values(d).map(v => `"${v}"`).join(",")).join("\n");
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Chart Data ---
  const chartData = useMemo(() => ({
    labels: dashboard.revenueTrend.map(r => r.date),
    datasets: [
      {
        label: "Revenue",
        data: dashboard.revenueTrend.map(r => r.amount),
        borderColor: "#198754",
        backgroundColor: "rgba(25,135,84,0.2)",
      }
    ]
  }), [dashboard.revenueTrend]);

  // --- Loading ---
  if (loading) return <p style={{ padding: 20 }}>Loading finance data...</p>;

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      <h2>Finance Admin Dashboard</h2>

      {/* Date Filter */}
      <div style={{ display: "flex", gap: 10, margin: "10px 0" }}>
        <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
        <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
        <button onClick={loadDashboard} style={buttonStyle}>Apply</button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by User ID, Amount, Status..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ padding: 8, width: "100%", borderRadius: 6, border: "1px solid #ccc", marginBottom: 20 }}
      />

      {/* Revenue Chart */}
      <div style={{ maxWidth: "100%", marginBottom: 30 }}>
        <Line data={chartData} />
      </div>

      {/* Payouts Table */}
      <TableSection
        title="Payouts"
        data={filteredAndSorted(dashboard.payouts)}
        onAction={approvePayout}
        actionLabel="Approve"
      />

      {/* Refunds Table */}
      <TableSection
        title="Refunds"
        data={filteredAndSorted(dashboard.refunds)}
        onAction={rejectRefund}
        actionLabel="Reject"
      />
    </div>
  );
}

// --- Table Section Component ---
function TableSection({ title, data, onAction, actionLabel }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3>{title}</h3>
        <button onClick={() => exportCSV(data, `${title.toLowerCase()}.csv`)} style={buttonStyle}>
          Export CSV
        </button>
      </div>
      {data.length === 0 ? (
        <p>No {title.toLowerCase()} found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f0f0f0" }}>
            <tr>
              <th style={thStyle}>User ID</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d._id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={tdStyle}>{d.userId}</td>
                <td style={tdStyle}>₦{d.amount}</td>
                <td style={tdStyle}>{d.completed ? "Completed" : "Pending"}</td>
                <td style={tdStyle}>
                  {!d.completed && (
                    <button onClick={() => onAction(d._id)} style={{ ...buttonStyle, background: actionLabel === "Approve" ? "#198754" : "#dc3545" }}>
                      {actionLabel}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Styles ---
const buttonStyle = {
  padding: "6px 12px",
  background: "#0d6efd",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer"
};

const thStyle = { padding: 8, textAlign: "left" };
const tdStyle = { padding: 8 };