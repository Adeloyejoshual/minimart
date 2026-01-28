// src/pages/admin/AdminManager.jsx
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { collection, getDocs, query, where } from "firebase/firestore";
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

  // --- Initialize Socket.IO for real-time updates ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    s.on("adminUpdate", () => {
      loadAllData(); // Refresh all panels on updates
    });

    return () => s.disconnect();
  }, []);

  // --- Load all data from Firebase ---
  const loadAllData = async () => {
    try {
      // Sellers
      const sellersSnap = await getDocs(collection(db, "sellers"));
      const sellersData = sellersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(sellersData);

      // Categories
      const categoriesSnap = await getDocs(collection(db, "categories"));
      const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(categoriesData);

      // Promotions
      const promotionsSnap = await getDocs(collection(db, "promotions"));
      const promotionsData = promotionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromotions(promotionsData);

      // Disputes
      const disputesSnap = await getDocs(collection(db, "disputes"));
      const disputesData = disputesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisputes(disputesData);

      // Stats
      setStats({
        "Pending Seller Approvals": sellersData.filter(s => s.status === "Pending").length,
        "Active Promotions": promotionsData.filter(p => p.active).length,
        "Active Disputes": disputesData.filter(d => d.status === "Open").length,
        "Sellers Approved Today": sellersData.filter(s => s.approvedToday).length,
      });
    } catch (err) {
      console.error("Failed to load admin manager data:", err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Handle actions (Approve Seller, Reject, Update Category/Promotion, Resolve Dispute) ---
  const handleAction = async (action, item) => {
    try {
      let colName = "";
      switch (item.type) {
        case "seller":
          colName = "sellers";
          break;
        case "category":
          colName = "categories";
          break;
        case "promotion":
          colName = "promotions";
          break;
        case "dispute":
          colName = "disputes";
          break;
        default:
          return;
      }

      const docRef = db.collection(colName).doc(item.id);

      switch (action) {
        case "approveSeller":
          await docRef.update({ status: "Approved", approvedToday: true });
          break;
        case "rejectSeller":
          await docRef.update({ status: "Rejected" });
          break;
        case "resolveDispute":
          await docRef.update({ status: "Resolved" });
          break;
        case "addNote":
          const note = prompt("Add a note:");
          if (note) await docRef.update({ note });
          break;
        case "togglePromotion":
          await docRef.update({ active: !item.active });
          break;
        default:
          break;
      }

      socket.emit("adminUpdate");
      loadAllData();
    } catch (err) {
      console.error("Action failed:", err);
    }
  };

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