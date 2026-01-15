import { useState } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import TopNav from "../components/TopNav";

export default function ApplySeller() {
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!shopName || !phone || !address) return alert("Fill all fields");

    try {
      await addDoc(collection(db, "sellerApplications"), {
        uid: auth.currentUser.uid,
        shopName,
        phone,
        address,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setMessage("Application submitted! Admin will review.");
      setShopName(""); setPhone(""); setAddress("");
    } catch (err) {
      console.error(err);
      alert("Failed: " + err.message);
    }
  };

  return (
    <div>
      <TopNav />
      <h2>Apply to Sell on MiniMart</h2>
      <input placeholder="Shop Name" value={shopName} onChange={e => setShopName(e.target.value)} /><br/>
      <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} /><br/>
      <input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} /><br/>
      <button onClick={handleSubmit}>Submit Application</button>
      {message && <p>{message}</p>}
    </div>
  );
}