// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import TopNav from "../components/TopNav";
import { FaHome, FaStore, FaShoppingCart, FaUser, FaGift, FaIdCard, FaEdit, FaMoneyBillAlt, FaStoreAlt, FaSpinner } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [couponBalance, setCouponBalance] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [latestSpin, setLatestSpin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- Load Firebase user ---
  useEffect(() => {
    const loadUser = async () => {
      if (!auth.currentUser) return;
      try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists()) setUserData(snap.data());
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    };
    loadUser();
  }, []);

  // --- Load live data from MongoDB ---
  const fetchLiveData = async () => {
    if (!auth.currentUser) return;
    try {
      const uid = auth.currentUser.uid;

      // 1️⃣ Coupon balance
      const couponRes = await axios.get(`/api/coupons?userId=${uid}`);
      setCouponBalance(couponRes.data.totalBalance || 0);

      // 2️⃣ Referral history
      const referralRes = await axios.get(`/api/referrals?userId=${uid}`);
      setReferralCount(referralRes.data.length);
      const totalReferral = referralRes.data.reduce((acc, r) => acc + r.reward, 0);

      // 3️⃣ Cart count
      const cartRes = await axios.get(`/api/cart?userId=${uid}`);
      setCartCount(cartRes.data.length || 0);

      // 4️⃣ Unread messages
      const msgRes = await axios.get(`/api/messages/unread?userId=${uid}`);
      setUnreadMessages(msgRes.data.count || 0);

      // 5️⃣ Latest Spin reward
      const spinRes = await axios.get(`/api/spin/latest?userId=${uid}`);
      if (spinRes.data) setLatestSpin(spinRes.data.reward);

      // Total coupon includes referral bonuses
      setCouponBalance(prev => (couponRes.data.totalBalance || 0) + totalReferral);

    } catch (err) {
      console.error("Failed to fetch live data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [userData]);

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  const kycStatusColor =
    userData?.kycStatus === "Approved" ? "#198754" :
    userData?.kycStatus === "Rejected" ? "#dc3545" : "#0d6efd";

  if (loading) return <p style={{ padding: 20 }}>Loading profile...</p>;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 90 }}>
      <TopNav />

      <div style={{ paddingTop: 70, maxWidth: 500, margin: "0 auto", paddingLeft: 16, paddingRight: 16 }}>
        {/* User Card */}
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          boxShadow: "0 6px 25px rgba(0,0,0,0.08)"
        }}>
          <h2>{userData?.fullName || auth.currentUser?.email}</h2>
          <p><strong>Email:</strong> {auth.currentUser?.email}</p>
          <p><strong>Role:</strong> {userData?.role || "User"}</p>
          <p>
            <strong>Verified:</strong>{" "}
            <span style={{ color: userData?.verified ? "#198754" : "#dc3545", fontWeight: 600 }}>
              {userData?.verified ? "Yes" : "No"}
            </span>
          </p>
          <p>
            <strong>KYC Status:</strong>{" "}
            <span style={{ color: kycStatusColor, fontWeight: 600 }}>
              {userData?.kycStatus || "Not Submitted"}
            </span>
          </p>
          <p>
            <strong>Coupon Balance:</strong>{" "}
            <span style={{ color: "#0D6EFD", fontWeight: 600 }}>₦{couponBalance}</span>
          </p>
          {referralCount > 0 && (
            <p><strong>Referrals:</strong> {referralCount} friends</p>
          )}
          {latestSpin && (
            <p><strong>Latest Spin Reward:</strong> {latestSpin}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <button onClick={() => navigate("/profile/edit")} style={actionBtnStyle}><FaEdit /> Edit Profile</button>
          <button onClick={() => navigate("/verify-id")} style={actionBtnStyle}><FaIdCard /> Verify ID / KYC</button>
          <button onClick={() => navigate("/profile/spin")} style={actionBtnStyle}><FaGift /> Spin Wheel / Coupons</button>
          <button onClick={() => navigate("/profile/make-money")} style={actionBtnStyle}><FaMoneyBillAlt /> Make Money</button>
          <button
            onClick={() => {
              if (!userData?.verified) {
                alert("Only verified users can apply to become a seller.");
                return;
              }
              navigate("/profile/become-seller");
            }}
            style={actionBtnStyle}
          >
            <FaStoreAlt /> Become Seller
          </button>
          <button onClick={() => signOut(auth)} style={{ ...actionBtnStyle, backgroundColor: "#dc3545" }}>Logout</button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        background: "#fff",
        borderTop: "1px solid #ddd",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 0",
        boxShadow: "0 -2px 6px rgba(0,0,0,0.08)",
        zIndex: 1000
      }}>
        {bottomLinks.map(link => (
          <div key={link.path} style={{ textAlign: "center", cursor: "pointer" }} onClick={() => navigate(link.path)}>
            <div style={{ position: "relative", fontSize: 20 }}>
              {link.icon}
              {link.badge > 0 && (
                <span style={{
                  position: "absolute",
                  top: -5,
                  right: -10,
                  background: "red",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: 10,
                  fontWeight: 600
                }}>
                  {link.badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>{link.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Button style
const actionBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#0D6EFD",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};