import { useState } from "react";

export default function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    price: "",
    category_id: "",
    description: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);

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

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/products",
      {
        method: "POST",
        body: fd,
      }
    );

    const data = await res.json();

    if (!res.ok) throw new Error("Product creation failed");

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
          amount: Number(form.price),
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) throw new Error("Payment init failed");

    return data.authorization_url;
  };

  /* ================= VERIFY PAYMENT ================= */
  const verifyPayment = async (reference) => {
    await fetch(
      "https://minimart-ivrm.onrender.com/api/paystack/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      }
    );
  };

  /* ================= SUBMIT FLOW ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. create product (draft)
      const productId = await createProduct();

      // 2. initialize payment
      const url = await initPayment(productId);

      // 3. redirect to Paystack
      window.location.href = url;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= RETURN FROM PAYSTACK ================= */
  const handleVerify = async () => {
    const reference = new URLSearchParams(window.location.search).get(
      "reference"
    );

    if (!reference) return;

    try {
      await verifyPayment(reference);
      alert("Payment successful & product activated!");
    } catch {
      alert("Verification failed");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Product (Test Paystack)</h2>

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
          placeholder="Price"
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

        <button disabled={loading}>
          {loading ? "Processing..." : "Create & Pay"}
        </button>
      </form>

      <hr />

      <button onClick={handleVerify}>
        Verify Payment (after redirect)
      </button>
    </div>
  );
}