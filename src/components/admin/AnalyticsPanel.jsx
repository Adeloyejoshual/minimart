// src/components/admin/AnalyticsPanel.jsx
import React from "react";
import { Bar, Pie } from "react-chartjs-2";

export default function AnalyticsPanel({ complaints, verifications, assistance }) {
  // Chart Data
  const complaintsData = {
    labels: ["Open", "Escalated", "Resolved"],
    datasets: [
      {
        label: "Complaints",
        data: [
          complaints.filter(c => c.status === "Open").length,
          complaints.filter(c => c.status === "Escalated").length,
          complaints.filter(c => c.status === "Resolved").length
        ],
        backgroundColor: ["#dc3545", "#ffc107", "#198754"]
      }
    ]
  };

  const verifData = {
    labels: ["Pending", "Verified", "Rejected"],
    datasets: [
      {
        label: "Verifications",
        data: [
          verifications.filter(v => v.status === "Pending").length,
          verifications.filter(v => v.status === "Verified").length,
          verifications.filter(v => v.status === "Rejected").length
        ],
        backgroundColor: ["#0d6efd", "#198754", "#dc3545"]
      }
    ]
  };

  const assistanceData = {
    labels: ["In Progress", "Completed"],
    datasets: [
      {
        label: "Assistance Requests",
        data: [
          assistance.filter(a => a.status === "In Progress").length,
          assistance.filter(a => a.status === "Completed").length
        ],
        backgroundColor: ["#ffc107", "#198754"]
      }
    ]
  };

  return (
    <div>
      <h3>Analytics & Reports</h3>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ width: "300px" }}>
          <Bar data={complaintsData} options={{ responsive: true }} />
        </div>
        <div style={{ width: "300px" }}>
          <Pie data={verifData} options={{ responsive: true }} />
        </div>
        <div style={{ width: "300px" }}>
          <Bar data={assistanceData} options={{ responsive: true }} />
        </div>
      </div>
    </div>
  );
}