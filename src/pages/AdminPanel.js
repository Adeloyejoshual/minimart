import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import TopNav from "../components/TopNav";

export default function AdminPanel() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "sellerApplications"));
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  const approve = async (app) => {
    await updateDoc(doc(db, "sellerApplications", app.id), { status: "approved" });
    await updateDoc(doc(db, "users", app.uid), { role: "seller", verified: true });
    alert("Seller approved!");
  };

  const reject = async (app) => {
    await updateDoc(doc(db, "sellerApplications", app.id), { status: "rejected" });
    alert("Seller rejected!");
  };

  return (
    <div>
      <TopNav />
      <h2>Admin Panel - Seller Applications</h2>
      {applications.map(app => (
        <div key={app.id} style={{ border: "1px solid #ccc", padding: 10, margin: 5 }}>
          <p><b>Shop:</b> {app.shopName}</p>
          <p><b>User ID:</b> {app.uid}</p>
          <p><b>Phone:</b> {app.phone}</p>
          <p><b>Address:</b> {app.address}</p>
          <p><b>Status:</b> {app.status}</p>
          {app.status === "pending" && (
            <>
              <button onClick={() => approve(app)}>Approve</button>
              <button onClick={() => reject(app)}>Reject</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}