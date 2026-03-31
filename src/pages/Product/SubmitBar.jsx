// Pages/Product/SubmitBar.jsx - PROMOTIONS + SUBMIT + RETRY
import { useEffect, useMemo } from "react";
import { promotionPlans } from "../../config/promotions.js";

export default function SubmitBar({
  form,
  loading,
  setLoading,
  selectedPlan,
  setSelectedPlan,
  paymentData,
  setPaymentData,
  images,
  states,
  cities,
  validate,
  previews, // For image count
  removeImage,
}) {
  /* ================= SUBMIT HANDLER ================= */
  const handleSubmit = async () => {
    if (loading) return;

    const error = validate();
    if (error) return alert(error);

    // Check location
    if (!states.includes(form.location_state)) return alert("Select state");
    if (!cities.includes(form.location_city)) return alert("Select city");
    
    // Check images
    if (images.length === 0) return alert("Add at least 1 image");

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);

    const fd = new FormData();
    const payload = {
      ...form,
      price: form.price.replace(/[^D]/g, ""),
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      promotion_plan: finalPlan.id,
      status: finalPlan.price === 0 ? "active" : "pending",
    };

    // Append form data
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    images.forEach((img) => fd.append("images", img));

    try {
      // 1. CREATE PRODUCT
      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Product creation failed");

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (finalPlan.price === 0) {
        // FREE PLAN ✅
        alert("✅ Product published successfully!");
        window.location.reload(); // Reset form
        return;
      }

      // 2. PAID PLAN - INITIATE PAYMENT
      const payRes = await fetch("https://minimart-ivrm.onrender.com/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        }),
      });

      const payData = await payRes.json();

      if (!payData.success || !payData.authorization_url) {
        // STORE FOR RETRY
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          planId: finalPlan.id,
          productId,
        });
        setLoading(false);
        return alert(payData.message || "Payment init failed - use Retry button");
      }

      // REDIRECT TO PAYMENT
      window.location.href = payData.authorization_url;
    } catch (err) {
      console.error(err);
      alert("❌ Upload failed. Please try again.");
      setLoading(false);
    }
  };

  /* ================= RETRY PAYMENT ================= */
  const retryPayment = async () => {
    if (!paymentData) return alert("No pending payment found");

    try {
      setLoading(true);
      const res = await fetch("https://minimart-ivrm.onrender.com/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      const data = await res.json();

      if (!data.success || !data.authorization_url) {
        setLoading(false);
        return alert(data.message || "Payment retry failed");
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      alert("Retry failed. Try again.");
      setLoading(false);
    }
  };

  const imageCount = previews.length;
  const hasRetry = !!paymentData;
  const freePlan = promotionPlans.find((p) => p.price === 0);
  const isValid = !loading && imageCount > 0;

  return (
    <div className="submit-bar">
      {/* PROMOTION PLANS */}
      <div className="plans-section">
        <h3>Promotion Plans</h3>
        <p className="plans-note">
          Free: {freePlan?.name} | Select paid plan for more visibility
        </p>
        <div className="plans-grid">
          {promotionPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onSelect={() => setSelectedPlan(plan)}
            />
          ))}
        </div>
      </div>

      {/* STATUS SUMMARY */}
      <div className="submit-summary">
        <div className="summary-item">
          <strong>Images:</strong> {imageCount}/8
        </div>
        <div className="summary-item">
          <strong>Plan:</strong> {selectedPlan?.name || "Free"}
        </div>
        {hasRetry && (
          <div className="summary-item warning">
            <strong>Payment Pending</strong> - Use Retry below
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="action-buttons">
        <button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className={`submit-btn ${loading ? "loading" : ""}`}
        >
          {loading 
            ? "⏳ Publishing..." 
            : hasRetry 
              ? "Save Draft" 
              : "🚀 Publish Product"
          }
        </button>

        {hasRetry && (
          <button
            onClick={retryPayment}
            disabled={loading}
            className="retry-btn"
          >
            {loading ? "Retrying..." : "💳 Retry Payment"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ================= PLAN CARD ================= */
function PlanCard({ plan, selected, onSelect }) {
  return (
    <div
      className={`plan-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <div className="plan-header">
        <strong>{plan.name}</strong>
        {selected && <span className="selected-badge">✓</span>}
      </div>
      <div className="plan-duration">{plan.duration}</div>
      <div className="plan-price">₦{Number(plan.price).toLocaleString()}</div>
    </div>
  );
}