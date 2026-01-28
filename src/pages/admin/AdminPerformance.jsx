// src/pages/admin/AdminPerformance.jsx
import { useEffect, useState } from "react";
import { getAdminPerformance } from "../../utils/getAdminPerformance";
import { Bar } from "react-chartjs-2";

export default function AdminPerformance() {
  const [performance, setPerformance] = useState([]);

  useEffect(() => {
    const loadPerformance = async () => {
      const data = await getAdminPerformance();
      setPerformance(data);
    };
    loadPerformance();
  }, []);

  const chartData = {
    labels: performance.map(p => p.adminEmail),
    datasets: [
      {
        label: "Disputes Resolved",
        data: performance.map(p => p.count),
        backgroundColor: "#4da6ff"
      }
    ]
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Performance – Dispute Resolution</h2>
      <Bar data={chartData} />
    </div>
  );
}