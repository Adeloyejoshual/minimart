import { useState } from "react";
import { promotionPlans } from "../config/promotions";

export default function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    price: "",
    category_id: "",
    description: "",
    email: "",
  });

  const [promotionId, setPromotionId] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedPlan = promotionPlans.find((p) => p.id === Number(promotionId));

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= CREATE PRODUCT ================= */
  const createProduct = async () => {
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("price", form.price);
    fd.append("category_id", form.category_id);
    fd.append("description", form.description);
    fd.append("promotion_id", promotionId);

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/products",
      {
        method: "POST",
        body: fd,
      }
    );

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Product creation failed");

    return data.product.id;
  };

  /* ================= INIT PAYMENT ================= */
  const initPayment = async (productId) => {
    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initialize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          email: form.email,
          amount: selectedPlan.price, // 👈 promotion price controls payment
          promotionId,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Payment init failed");

    return data.authorization_url;
  };

  /* ================= SUBMIT FLOW ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productId = await createProduct();
      const url = await initPayment(productId);

      window.location.href = url;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= VERIFY PAYMENT ================= */
  const handleVerify = async () => {
    const reference = new URLSearchParams(window.location.search).get(
      "reference"
    );

    if (!reference) return;

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/paystack/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      }
    );

    const data = await res.json();

    if (data.success) {
      alert("Payment successful + Product activated!");
    } else {
      alert("Verification failed");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Product (Paystack + Promotions)</h2>

      {/* ========== PRODUCT FORM ========== */}
      <form onSubmit={handleSubmit}>
        <input
          name="title"
          placeholder="Title"
          onChange={handleChange}
          required
        />
        <br />

        <input
          name="price"
          placeholder="Base Price"
          type="number"
          onChange={handleChange}
          required
        />
        <br />

        <input
          name="category_id"
          placeholder="Category ID"
          onChange={handleChange}
          required
        />
        <br />

        <input
          name="email"
          placeholder="Email"
          onChange={handleChange}
          required
        />
        <br />

        <textarea
          name="description"
          placeholder="Description"
          onChange={handleChange}
        />
        <br />

        {/* ========== PROMOTION SELECT ========== */}
        <h3>Select Promotion Plan</h3>

        {promotionPlans.map((plan) => (
          <label key={plan.id} style={{ display: "block", marginBottom: 10 }}>
            <input
              type="radio"
              name="promotion"
              value={plan.id}
              checked={Number(promotionId) === plan.id}
              onChange={() => setPromotionId(plan.id)}
            />
            <strong> {plan.name}</strong> — ₦{plan.price}
            <br />
            <small>{plan.description}</small>
          </label>
        ))}

        <br />

        <button disabled={loading}>
          {loading
            ? "Processing..."
            : `Pay ₦${selectedPlan?.price || 0} & Publish`}
        </button>
      </form>

      <hr />

      {/* ========== VERIFY BUTTON (TEST ONLY) ========== */}
      <button onClick={handleVerify}>
        Verify Payment (after redirect)
      </button>
    </div>
  );
}