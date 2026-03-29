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

  // simulate logged-in user
  const user = {
    email: "test@email.com",
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      alert("Fill all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productData: formData,
          email: user.email,
          amount: selectedPlan.price,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Payment failed to initialize");
        setLoading(false);
        return;
      }

      // 🚀 Redirect to Paystack
      window.location.href = data.authorization_url;

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Add Product</h2>

      <input
        name="name"
        placeholder="Product Name"
        onChange={handleChange}
      />

      <input
        name="price"
        placeholder="Price"
        type="number"
        onChange={handleChange}
      />

      <textarea
        name="description"
        placeholder="Description"
        onChange={handleChange}
      />

      <h3>Choose Promotion</h3>

      {promotionPlans.map((plan) => (
        <div key={plan.id}>
          <label>
            <input
              type="radio"
              name="plan"
              checked={selectedPlan.id === plan.id}
              onChange={() => setSelectedPlan(plan)}
            />
            {plan.name} - ₦{plan.price}
          </label>
        </div>
      ))}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Post & Pay"}
      </button>
    </div>
  );
}