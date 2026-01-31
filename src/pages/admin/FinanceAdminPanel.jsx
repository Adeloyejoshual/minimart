import { useState, useEffect } from "react";

export default function FinanceAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState([]);
  const [refunds, setRefunds] = useState([]);

  // Simulate loading data
  useEffect(() => {
    setLoading(true);

    // Replace this with real API or Firestore fetch
    const fakeData = () => {
      setPayouts([
        { id: 1, userId: "user123", amount: 5000, completed: false },
        { id: 2, userId: "user456", amount: 12000, completed: true },
      ]);

      setRefunds([
        { id: 1, userId: "user789", amount: 3000, completed: false },
        { id: 2, userId: "user321", amount: 4500, completed: true },
      ]);
    };

    setTimeout(() => {
      fakeData();
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading finance dashboard...</p>;

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <h2>Finance Admin Dashboard</h2>

      <h3>Payouts</h3>
      <table border="1" cellPadding="6" style={{ width: "100%", marginBottom: 20 }}>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map(p => (
            <tr key={p.id}>
              <td>{p.userId}</td>
              <td>₦{p.amount}</td>
              <td>{p.completed ? "Completed" : "Pending"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Refunds</h3>
      <table border="1" cellPadding="6" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {refunds.map(r => (
            <tr key={r.id}>
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