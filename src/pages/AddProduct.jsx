// src/pages/TestPromotionPage.jsx
import { useState, useEffect } from "react";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";

export default function TestPromotionPage() {
  const [price, setPrice] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPrice = p => p.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Auto verify payment if redirected back from Paystack
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference) return;

    async function verifyPayment() {
      setLoading(true);
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/test-promote/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({ reference })
        });
        const data = await res.json();
        if (res.ok) alert("✅ Payment verified successfully!");
        else alert("❌ Payment verification failed: " + data.message);
        window.history.replaceState(null, "", window.location.pathname);
      } catch (err) {
        console.error(err);
        alert("Payment verification error");
      } finally { setLoading(false); }
    }

    verifyPayment();
  }, []);

  const handleSubmit = async () => {
    if (!price || !promotionId) return alert("Enter price and select promotion");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", "Test Product");
      formData.append("price", price);
      formData.append("promotion_id", promotionId);

      const res = await fetch("https://minimart-ivrm.onrender.com/api/test-promote/init", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Redirect to Paystack checkout
      window.location.href = data.payment.authorization_url;

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to initiate promotion");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Test Promotion Plans</h2>

      <div>
        <label>Price (₦)</label>
        <input
          type="text"
          value={formatPrice(price)}
          onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="5000"
        />
      </div>

      <div>
        <label>Promotion Plan</label>
        <select value={promotionId} onChange={e => setPromotionId(e.target.value)}>
          <option value="">Select plan</option>
          {promotionPlans.map(plan => {
            const discountPercent = getDiscountPercent(plan.originalPrice, plan.discount);
            const activePrice = getActivePrice(plan.price, plan.discount);
            return (
              <option key={plan.id} value={plan.id}>
                {plan.name} - ₦{activePrice.toLocaleString()} ({discountPercent}% off)
              </option>
            );
          })}
        </select>
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Initializing Paystack..." : "Test Promotion"}
      </button>
    </div>
  );
}