// src/pages/admin/AdminManager.jsx
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Header from "../../components/admin/Header";
import Sidebar from "../../components/admin/Sidebar";
import QuickStats from "../../components/admin/QuickStats";
import SellerTable from "../../components/admin/SellerTable";
import CategoryPromotionPanel from "../../components/admin/CategoryPromotionPanel";
import DisputeTable from "../../components/admin/DisputeTable";
import AnalyticsPanel from "../../components/admin/AnalyticsPanel";

export default function AdminManager() {
  const [activePanel, setActivePanel] = useState("Dashboard");
  const [socket, setSocket] = useState(null);

  const [stats, setStats] = useState({
    "Pending Seller Approvals": 0,
    "Active Promotions": 0,
    "Active Disputes": 0,
    "Sellers Approved Today": 0,
  });

  const [sellers, setSellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [disputes, setDisputes] = useState([]);

  // -------------------- Initialize Socket.IO --------------------
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("adminUpdate", () => loadAllData());

    return () => s.disconnect();
  }, []);

  // -------------------- Load All Data --------------------
  const loadAllData = async () => {
    try {
      // --- Sellers ---
      const sellersSnap = await getDocs(collection(db, "sellers"));
      const sellersData = sellersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(sellersData);

      // --- Categories ---
      const categoriesSnap = await getDocs(collection(db, "categories"));
      const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(categoriesData);

      // --- Promotions ---
      const promotionsSnap = await getDocs(collection(db, "promotions"));
      const promotionsData = promotionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromotions(promotionsData);

      // --- Disputes ---
      const disputesSnap = await getDocs(collection(db, "disputes"));
      const disputesData = disputesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisputes(disputesData);

      // --- Stats ---
      const today = new Date();
      const approvedTodayCount = sellersData.filter(s => {
        if (!s.approvedAt) return false;
        const approvedDate = s.approvedAt.toDate ? s.approvedAt.toDate() : new Date(s.approvedAt);
        return (
          approvedDate.getDate() === today.getDate() &&
          approvedDate.getMonth() === today.getMonth() &&
          approvedDate.getFullYear() === today.getFullYear()
        );
      }).length;

      setStats({
        "Pending Seller Approvals": sellersData.filter(s => s.status === "Pending").length,
        "Active Promotions": promotionsData.filter(p => p.active).length,
        "Active Disputes": disputesData.filter(d => d.status === "Open").length,
        "Sellers Approved Today": approvedTodayCount,
      });
    } catch (err) {
      console.error("Failed to load admin manager data:", err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // -------------------- Handle Actions --------------------
  const handleAction = async (action, item) => {
    try {
      let colName = "";
      switch (item.type) {
        case "seller": colName = "sellers"; break;
        case "category": colName = "categories"; break;
        case "promotion": colName = "promotions"; break;
        case "dispute": colName = "disputes"; break;
        default: return;
      }

      const docRef = doc(db, colName, item.id);

      switch (action) {
        case "approveSeller":
          await updateDoc(docRef, { status: "Approved", approvedAt: new Date(), approvedToday: true });
          break;
        case "rejectSeller":
          await updateDoc(docRef, { status: "Rejected" });
          break;
        case "resolveDispute":
          await updateDoc(docRef, { status: "Resolved" });
          break;
        case "addNote":
          const note = prompt("Add a note:");
          if (note) await updateDoc(docRef, { note });
          break;
        case "togglePromotion":
          await updateDoc(docRef, { active: !item.active });
          break;
        default:
          break;
      }

      if (socket) socket.emit("adminUpdate");
      loadAllData();
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

  // -------------------- Render --------------------
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={activePanel} setActive={setActivePanel} />
      <div style={{ flex: 1 }}>
        <Header adminName="Admin Manager" />
        <div style={{ padding: 20 }}>
          <QuickStats stats={stats} />

          {activePanel === "Sellers" && (
            <SellerTable sellers={sellers.map(s => ({ ...s, type: "seller" }))} onAction={handleAction} />
          )}

          {activePanel === "Categories & Promotions" && (
            <CategoryPromotionPanel
              categories={categories.map(c => ({ ...c, type: "category" }))}
              promotions={promotions.map(p => ({ ...p, type: "promotion" }))}
              onAction={handleAction}
            />
          )}

          {activePanel === "Disputes" && (
            <DisputeTable disputes={disputes.map(d => ({ ...d, type: "dispute" }))} onAction={handleAction} />
          )}

          {activePanel === "Reports" && (
            <AnalyticsPanel sellers={sellers} promotions={promotions} disputes={disputes} />
          )}
        </div>
      </div>
    </div>
  );
}