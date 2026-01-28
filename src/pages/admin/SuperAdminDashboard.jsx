// src/pages/admin/SuperAdminDashboard.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { Bar } from "react-chartjs-2";

export default function SuperAdminDashboard() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [kycList, setKycList] = useState([]);
  const [products, setProducts] = useState([]);
  const [finance, setFinance] = useState({});
  const [payouts, setPayouts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [adminPerformance, setAdminPerformance] = useState([]);
  const [flaggedSellers, setFlaggedSellers] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);

  // --- Initialize Socket.IO ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("kycUpdated", (updatedKyc) => {
      setKycList((prev) =>
        prev.map((k) => (k.userId === updatedKyc.userId ? updatedKyc : k))
      );
      addNotification(`KYC updated for user ${updatedKyc.userId}`);
    });

    s.on("productUpdated", (updatedProduct) => {
      setProducts((prev) =>
        prev.map((p) => (p._id === updatedProduct._id ? updatedProduct : p))
      );
      addNotification(`Product ${updatedProduct.name} updated`);
    });

    s.on("financeUpdated", (data) => {
      setFinance(data);
      addNotification(`Finance dashboard updated`);
    });

    s.on("payoutUpdated", (updatedPayout) => {
      setPayouts((prev) =>
        prev.map((p) => (p._id === updatedPayout._id ? updatedPayout : p))
      );
      addNotification(`Payout status updated for ${updatedPayout.sellerId}`);
    });

    s.on("loginHistoryUpdated", (newLogin) => {
      setLoginHistory((prev) => [newLogin, ...prev]);
      addNotification(`User login: ${newLogin.email}`);
    });

    return () => s.disconnect();
  }, []);

  const addNotification = (message) => {
    setNotifications((prev) => [{ message, timestamp: new Date() }, ...prev]);
  };

  // --- Load all data ---
  const loadData = async () => {
    try {
      setLoading(true);
      const [
        usersRes,
        kycRes,
        productsRes,
        financeRes,
        payoutsRes,
        performanceRes,
        flaggedRes,
        loginHistoryRes
      ] = await Promise.all([
        axios.get("/api/admin/users"),
        axios.get("/api/admin/kyc"),
        axios.get("/api/admin/products"),
        axios.get("/api/admin/finance"),
        axios.get("/api/admin/payouts"),
        axios.get("/api/admin/performance"),
        axios.get("/api/admin/flagged-sellers"),
        axios.get("/api/admin/login-history")
      ]);

      setUsers(usersRes.data);
      setKycList(kycRes.data);
      setProducts(productsRes.data);
      setFinance(financeRes.data);
      setPayouts(payoutsRes.data);
      setAdminPerformance(performanceRes.data);
      setFlaggedSellers(flaggedRes.data);
      setLoginHistory(loginHistoryRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- KYC Status ---
  const updateKycStatus = async (userId, status) => {
    try {
      const res = await axios.patch(`/api/admin/kyc/${userId}`, { verified: status === "Approved" });
      socket.emit("adminKycUpdate", res.data);
      setKycList((prev) =>
        prev.map((k) => (k.userId === userId ? res.data : k))
      );
      addNotification(`KYC ${status} for user ${userId}`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update KYC status");
    }
  };

  // --- Product Status ---
  const updateProductStatus = async (productId, approved) => {
    try {
      const res = await axios.patch(`/api/admin/products/${productId}`, { approved });
      socket.emit("adminProductUpdate", res.data);
      setProducts((prev) =>
        prev.map((p) => (p._id === productId ? res.data : p))
      );
      addNotification(`Product ${approved ? "approved" : "rejected"}: ${res.data.name}`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update product status");
    }
  };

  // --- Payout Status ---
  const updatePayoutStatus = async (payoutId, approved) => {
    try {
      const res = await axios.patch(`/api/admin/payouts/${payoutId}`, { approved });
      socket.emit("adminPayoutUpdate", res.data);
      setPayouts((prev) =>
        prev.map((p) => (p._id === payoutId ? res.data : p))
      );
      addNotification(`Payout ${approved ? "approved" : "rejected"} for seller ${res.data.sellerId}`);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update payout status");
    }
  };

  if (loading) return <p style={{ padding: 30 }}>Loading dashboard...</p>;

  const chartData = {
    labels: adminPerformance.map(a => a.adminEmail),
    datasets: [
      {
        label: "Disputes Resolved",
        data: adminPerformance.map(a => a.count),
        backgroundColor: "#4da6ff"
      }
    ]
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1>Super Admin Dashboard</h1>
      <h3>Real-time Marketplace Management</h3>

      {/* --- Dashboard Stats --- */}
      <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, padding: 20, background: "#eef5ff", borderRadius: 12 }}>
          <h4>Users</h4>
          <p>Total Users: {users.length}</p>
          <p>Pending KYC: {kycList.filter(k => !k.verified).length}</p>
        </div>
        <div style={{ flex: 1, minWidth: 200, padding: 20, background: "#fff3cd", borderRadius: 12 }}>
          <h4>Products</h4>
          <p>Total Products: {products.length}</p>
          <p>Pending Approval: {products.filter(p => !p.approved).length}</p>
        </div>
        <div style={{ flex: 1, minWidth: 200, padding: 20, background: "#d1e7dd", borderRadius: 12 }}>
          <h4>Finance</h4>
          <p>Total Revenue: ₦{finance.totalRevenue || 0}</p>
          <p>Pending Payouts: ₦{finance.pendingPayouts || 0}</p>
        </div>
      </div>

      {/* --- Admin Performance --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Top Performing Admins</h2>
        {adminPerformance.length === 0 ? <p>No data yet.</p> : <Bar data={chartData} />}
      </section>

      {/* --- Suspicious Sellers --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Suspicious Sellers</h2>
        {flaggedSellers.length === 0 ? <p>No suspicious sellers.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th>Seller ID</th>
                <th>Name</th>
                <th>Flag Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {flaggedSellers.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.flagReason}</td>
                  <td style={{ color: "red", fontWeight: "bold" }}>Suspicious</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* --- KYC Management --- */}
      <section style={{ marginTop: 40 }}>
        <h2>KYC Approvals</h2>
        {kycList.length === 0 ? <p>No KYC submissions found.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th>User ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {kycList.map(k => (
                <tr key={k.userId} style={{ borderBottom: "1px solid #ddd" }}>
                  <td>{k.userId}</td>
                  <td>{k.fullName}</td>
                  <td style={{ color: k.verified ? "#198754" : "#0d6efd" }}>
                    {k.verified ? "Approved" : "Pending"}
                  </td>
                  <td>
                    {k.documentUrl && <a href={k.documentUrl} target="_blank" rel="noreferrer">View</a>}
                  </td>
                  <td>
                    {!k.verified && (
                      <>
                        <button onClick={() => updateKycStatus(k.userId, "Approved")} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}>Approve</button>
                        <button onClick={() => updateKycStatus(k.userId, "Rejected")} style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>Reject</button>
                      </>
                    )}
                    {k.verified && <span>Locked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* --- Product Approvals --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Product Approvals</h2>
        {products.length === 0 ? <p>No products found.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th>Product ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td>{p._id}</td>
                  <td>{p.name}</td>
                  <td style={{ color: p.approved ? "#198754" : "#0d6efd" }}>
                    {p.approved ? "Approved" : "Pending"}
                  </td>
                  <td>
                    {!p.approved && (
                      <>
                        <button onClick={() => updateProductStatus(p._id, true)} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}>Approve</button>
                        <button onClick={() => updateProductStatus(p._id, false)} style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>Reject</button>
                      </>
                    )}
                    {p.approved && <span>Locked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* --- Payout Management --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Seller Payouts</h2>
        {payouts.length === 0 ? <p>No payout requests found.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th>Payout ID</th>
                <th>Seller ID</th>
                <th>Amount (₦)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p._id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td>{p._id}</td>
                  <td>{p.sellerId}</td>
                  <td>{p.amount}</td>
                  <td style={{ color: p.approved ? "#198754" : "#0d6efd" }}>
                    {p.approved ? "Approved" : "Pending"}
                  </td>
                  <td>
                    {!p.approved && (
                      <>
                        <button onClick={() => updatePayoutStatus(p._id, true)} style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}>Approve</button>
                        <button onClick={() => updatePayoutStatus(p._id, false)} style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}>Reject</button>
                      </>
                    )}
                    {p.approved && <span>Locked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* --- Notifications --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Notifications</h2>
        {notifications.length === 0 ? <p>No notifications yet.</p> : (
          <ul>
            {notifications.map((n, i) => (
              <li key={i}>{n.timestamp.toLocaleTimeString()}: {n.message}</li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Login History (IP tracking) --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Recent User Logins</h2>
        {loginHistory.length === 0 ? <p>No login data.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th>User ID</th>
                <th>Email</th>
                <th>IP Address</th>
                <th>Login Time</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map(l => (
                <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td>{l.userId}</td>
                  <td>{l.email}</td>
                  <td>{l.ip}</td>
                  <td>{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}