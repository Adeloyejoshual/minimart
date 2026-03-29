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

  const [selectedPlan, setSelectedPlan] = useState(promotionPlans[0]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= CREATE PRODUCT (NO DB PAYSTACK FLOW ONLY TEST) ================= */
  const createProductMock = async () => {
    // TEMP: no DB dependency for test
    return "test-product-id-123";
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
          amount: Number(selectedPlan.price), // 🔥 promotion price
          promotionId: selectedPlan.id,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Payment init failed");

    return data.authorization_url;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const productId = await createProductMock();
      const url = await initPayment(productId);

      window.location.href = url;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= VERIFY AFTER RETURN ================= */
  const verifyPayment = async () => {
    const reference = new URLSearchParams(window.location.search).get(
      "reference"
    );

    if (!reference) return;

    try {
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
        alert("Payment successful & product activated!");
      } else {
        alert("Payment verification failed");
      }
    } catch {
      alert("Verification error");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Product (Paystack Test + Promotions)</h2>

      {/* ================= FORM ================= */}
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

        {/* ================= PROMOTION SELECT ================= */}
        <h3>Select Promotion Plan</h3>

        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            style={{
              border:
                selectedPlan.id === plan.id
                  ? "2px solid green"
                  : "1px solid gray",
              padding: 10,
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <strong>{plan.name}</strong>
            <p>{plan.description}</p>
            <p>Price: ₦{plan.price}</p>
            <p>Duration: {plan.duration}</p>
          </div>
        ))}

        <button disabled={loading}>
          {loading ? "Processing..." : "Pay & Publish"}
        </button>
      </form>

      <hr />

      {/* ================= VERIFY BUTTON ================= */}
      <button onClick={verifyPayment}>
        Verify Payment (after redirect)
      </button>
    </div>
  );
}