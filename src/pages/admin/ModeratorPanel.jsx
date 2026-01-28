import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { auth } from "../../firebase"; // Firebase auth
import { onAuthStateChanged } from "firebase/auth";

export default function ModeratorPanel() {
  const [moderator, setModerator] = useState(null);
  const [products, setProducts] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  // --- Firebase Authentication ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setModerator(user);
        initSocket();
        loadData();
      } else {
        setModerator(null);
        if (socket) socket.disconnect();
      }
    });

    return () => unsubscribe();
  }, []);

  // --- Initialize Socket.IO ---
  const initSocket = () => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    // Listen to live updates
    s.on("productUpdated", (updatedProduct) => {
      setProducts(prev => prev.map(p => p._id === updatedProduct._id ? updatedProduct : p));
    });
    s.on("reportUpdated", (updatedReport) => {
      setReports(prev => prev.map(r => r._id === updatedReport._id ? updatedReport : r));
    });

    return () => s.disconnect();
  };

  // --- Load initial data ---
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, repRes, statsRes] = await Promise.all([
        axios.get("/api/moderator/pending-products"),
        axios.get("/api/moderator/reports"),
        axios.get("/api/moderator/analytics"),
      ]);
      setProducts(prodRes.data);
      setReports(repRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to load moderator data:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Handle product moderation ---
  const handleProductAction = async (productId, action, notes = "") => {
    if (!moderator) return alert("Please login first");

    try {
      const res = await axios.patch(`/api/moderator/product/${productId}`, {
        action,
        notes,
        moderatorId: moderator.uid,
      });
      // Live update via Socket.IO handles state update
    } catch (err) {
      console.error("Failed to update product:", err);
      alert("❌ Failed to update product status");
    }
  };

  // --- Handle report action ---
  const handleReportAction = async (reportId, action, notes = "") => {
    if (!moderator) return alert("Please login first");

    try {
      const res = await axios.patch(`/api/moderator/report/${reportId}`, {
        action,
        notes,
        moderatorId: moderator.uid,
      });
      // Live update via Socket.IO handles state update
    } catch (err) {
      console.error("Failed to update report:", err);
      alert("❌ Failed to update report status");
    }
  };

  if (!moderator) return <p style={{ padding: 20 }}>Please login as a moderator to access this panel.</p>;

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2>Moderator Dashboard</h2>

      {loading ? <p>Loading data...</p> : (
        <>
          <div style={{ marginBottom: 20 }}>
            <h4>Analytics:</h4>
            <p>Pending Products: {stats.productStats?.pending || 0}</p>
            <p>Approved Products: {stats.productStats?.approved || 0}</p>
            <p>Rejected Products: {stats.productStats?.rejected || 0}</p>
            <p>Flagged Products: {stats.productStats?.flagged || 0}</p>
            <p>Total Reports: {stats.reportStats?.totalReports || 0}</p>
            <p>Resolved Reports: {stats.reportStats?.resolvedReports || 0}</p>
          </div>

          {/* Pending Products Table */}
          <h3>Pending Products</h3>
          {products.length === 0 ? <p>No pending products</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th>Product ID</th>
                  <th>Seller</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p._id} style={{ borderBottom: "1px solid #ddd" }}>
                    <td>{p._id}</td>
                    <td>{p.sellerName}</td>
                    <td>{p.title}</td>
                    <td>{p.status}</td>
                    <td>
                      {p.status === "Pending" && (
                        <>
                          <button onClick={() => handleProductAction(p._id, "Approve")} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff" }}>Approve</button>
                          <button onClick={() => handleProductAction(p._id, "Reject")} style={{ marginRight: 6, padding: 6, background: "#dc3545", color: "#fff" }}>Reject</button>
                          <button onClick={() => handleProductAction(p._id, "Flag")} style={{ padding: 6, background: "#ffc107", color: "#000" }}>Flag</button>
                        </>
                      )}
                      {p.status !== "Pending" && <span>Locked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Reports Table */}
          <h3>User Reports</h3>
          {reports.length === 0 ? <p>No reports</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th>Report ID</th>
                  <th>User</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r._id} style={{ borderBottom: "1px solid #ddd" }}>
                    <td>{r._id}</td>
                    <td>{r.reportedUserName}</td>
                    <td>{r.reason}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.status === "Pending" && (
                        <>
                          <button onClick={() => handleReportAction(r._id, "Resolved")} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff" }}>Resolve</button>
                          <button onClick={() => handleReportAction(r._id, "Escalated")} style={{ padding: 6, background: "#dc3545", color: "#fff" }}>Escalate</button>
                        </>
                      )}
                      {r.status !== "Pending" && <span>Locked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}