import { useState } from "react";

export default function AddProduct() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(500);
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
          amount,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Failed");
        console.log(data);
        return;
      }

      // redirect to Paystack
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
      <h2>Paystack Test</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={handlePay} disabled={loading}>
        {loading ? "Loading..." : "Pay Now"}
      </button>
    </div>
  );
}