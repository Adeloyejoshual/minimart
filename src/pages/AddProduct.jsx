import { useState } from "react";
import { promotionPlans } from "../config/promotions.js";

export default function AddProduct() {
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
  });

  const [selectedPlan, setSelectedPlan] = useState(promotionPlans[0]);
  const [loading, setLoading] = useState(false);

  const user = {
    email: "test@email.com", // replace with real auth user
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      /* ================= VALIDATION ================= */
      if (!formData.name || !formData.price) {
        alert("Please fill all product fields");
        return;
      }

      // 🚨 FREE PLAN HANDLING (skip Paystack)
      if (selectedPlan.price === 0) {
        const res = await fetch("/api/product/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            email: user.email,
          }),
        });

        if (res.ok) {
          alert("Product posted successfully (Free plan)");
        }

        return;
      }

      /* ================= PAYMENT INIT ================= */
      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productData: {
            name: formData.name,
            price: formData.price,
            description: formData.description,
          },
          email: user.email,
          amount: Number(selectedPlan.price),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        console.error(data);
        alert(data.error || "Payment initialization failed");
        return;
      }

      /* ================= REDIRECT TO PAYSTACK ================= */
      window.location.href = data.authorization_url;

    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px" }}>
      <h2>Add Product</h2>

      <input
        name="name"
        placeholder="Product Name"
        onChange={handleChange}
      />

      <input
        name="price"
        type="number"
        placeholder="Product Price"
        onChange={handleChange}
      />

      <textarea
        name="description"
        placeholder="Description"
        onChange={handleChange}
      />

      <h3>Promotion Plan</h3>

      {promotionPlans.map((plan) => (
        <label key={plan.id} style={{ display: "block", margin: "8px 0" }}>
          <input
            type="radio"
            name="plan"
            checked={selectedPlan.id === plan.id}
            onChange={() => setSelectedPlan(plan)}
          />
          {plan.name} - ₦{plan.price}
        </label>
      ))}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Post Product & Pay"}
      </button>
    </div>
  );
}