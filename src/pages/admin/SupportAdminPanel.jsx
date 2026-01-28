// src/pages/admin/SupportAdminPanel.jsx
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // your firebase.js
import Header from "../../components/admin/Header";
import Sidebar from "../../components/admin/Sidebar";
import QuickStats from "../../components/admin/QuickStats";
import ComplaintsTable from "../../components/admin/ComplaintsTable";
import VerificationTable from "../../components/admin/VerificationTable";
import AssistanceTable from "../../components/admin/AssistanceTable";
import AnalyticsPanel from "../../components/admin/AnalyticsPanel";

export default function SupportAdminPanel() {
  const [activePanel, setActivePanel] = useState("Dashboard");
  const [stats, setStats] = useState({
    "Open Complaints": 0,
    "Pending Verifications": 0,
    "Listing Assistance": 0,
    "Resolved Today": 0
  });

  const [complaints, setComplaints] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  const [socket, setSocket] = useState(null);

  // --- Initialize Socket.IO for real-time updates ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("supportUpdate", () => {
      loadAllData(); // refresh all panels
    });

    return () => s.disconnect();
  }, []);

  // --- Load all data from Firebase ---
  const loadAllData = async () => {
    try {
      // Complaints
      const complaintsSnap = await getDocs(collection(db, "complaints"));
      const complaintsData = complaintsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(complaintsData);

      // Verifications (Pending only)
      const verifSnap = await getDocs(query(collection(db, "kyc"), where("status", "==", "Pending")));
      const verifData = verifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVerifications(verifData);

      // Assistance Requests
      const assistSnap = await getDocs(collection(db, "assistance"));
      const assistData = assistSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssistanceRequests(assistData);

      // Stats
      setStats({
        "Open Complaints": complaintsData.filter(c => c.status === "Open").length,
        "Pending Verifications": verifData.length,
        "Listing Assistance": assistData.filter(a => a.status === "In Progress").length,
        "Resolved Today": complaintsData.filter(c => c.resolvedToday).length
      });

    } catch (err) {
      console.error("Failed to load support data:", err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Handle Actions (Resolve, Escalate, Approve, Reject, Guide) ---
  const handleAction = async (action, item) => {
    try {
      // This is where you update Firebase documents
      const col = item.type === "complaint" ? "complaints" : item.type === "verification" ? "kyc" : "assistance";
      const docRef = db.collection(col).doc(item.id);

      switch (action) {
        case "resolve":
          await docRef.update({ status: "Resolved", resolvedToday: true });
          break;
        case "escalate":
          await docRef.update({ status: "Escalated" });
          break;
        case "approve":
          await docRef.update({ status: "Verified" });
          break;
        case "reject":
          await docRef.update({ status: "Rejected" });
          break;
        case "guide":
          await docRef.update({ status: "In Progress", note: "Support guidance provided" });
          break;
        case "note":
          const note = prompt("Add a note for the user:");
          if (note) await docRef.update({ note });
          break;
        default:
          break;
      }

      socket.emit("supportUpdate"); // notify all admins in real-time
      loadAllData(); // refresh after action
    } catch (err) {
      console.error("Failed to perform action:", err);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={activePanel} setActive={setActivePanel} />
      <div style={{ flex: 1 }}>
        <Header adminName="Support Admin" />
        <div style={{ padding: 20 }}>
          <QuickStats stats={stats} />

          {activePanel === "Complaints" && <ComplaintsTable complaints={complaints.map(c => ({ ...c, type: "complaint" }))} onAction={handleAction} />}
          {activePanel === "Verification Requests" && <VerificationTable verifications={verifications.map(v => ({ ...v, type: "verification" }))} onAction={handleAction} />}
          {activePanel === "Listing Assistance" && <AssistanceTable assistance={assistanceRequests.map(a => ({ ...a, type: "assistance" }))} onAction={handleAction} />}
          {activePanel === "Reports" && <AnalyticsPanel complaints={complaints} verifications={verifications} assistance={assistanceRequests} />}
        </div>
      </div>
    </div>
  );
}