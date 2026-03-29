import { useState } from "react";
import { promotionPlans } from "../config/promotions.js";

export default function AddProduct() {
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(promotionPlans[0]);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          planId: selectedPlan.id,
          amount: selectedPlan.price,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Failed");
        console.log(data);
        return;
      }

      // FREE PLAN
      if (data.free) {
        alert("Free plan activated!");
        return;
      }

      // PAYSTACK REDIRECT
      window.location.href = data.authorization_url;

    } catch (err) {
      console.error(err);
      alert("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Promotion Plans</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {promotionPlans.map((plan) => (
        <div key={plan.id} style={{ margin: 10 }}>
          <label>
            <input
              type="radio"
              checked={selectedPlan.id === plan.id}
              onChange={() => setSelectedPlan(plan)}
            />
            {plan.name} - ₦{plan.price}
          </label>

          <p>{plan.description}</p>
        </div>
      ))}

      <button onClick={handlePay} disabled={loading}>
        {loading ? "Processing..." : "Continue"}
      </button>
    </div>
  );
}