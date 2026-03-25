// src/pages/TestPromotionPage.jsx
import { useState, useEffect } from "react";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";

export default function TestPromotionPage() {
  const [price, setPrice] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPrice = p => p.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const handleSubmit = async () => {
    if (!price || !promotionId) return alert("Enter price and select promotion");

    setLoading(true);
    try {
      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products/initiate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: new FormData(Object.entries({
          title: "Test Product",
          price,
          category_id: "test-category",
          promotion_id: promotionId,
          dynamicFields: JSON.stringify({}),
          images: "", // dummy for test
        }))
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // redirect to Paystack
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