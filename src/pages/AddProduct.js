import { useEffect } from "react";

export default function AddProduct() {
  // Load Paystack script dynamically
  useEffect(() => {
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Paystack payment function
  const payWithPaystack = () => {
    if (!window.PaystackPop) {
      alert("Paystack not loaded");
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY, // your frontend public key
      email: "customer@email.com", // test or user email
      amount: 1000 * 100, // amount in kobo (₦1,000)
      currency: "NGN",

      callback: function (response) {
        alert("Payment successful ✅ Reference: " + response.reference);
        console.log("Paystack response:", response);
      },

      onClose: function () {
        alert("Payment cancelled ❌");
      },
    });

    handler.openIframe();
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        onClick={payWithPaystack}
        style={{
          padding: "16px 32px",
          fontSize: "18px",
          borderRadius: "10px",
          border: "none",
          background: "#0aa85f",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Pay with Paystack
      </button>
    </div>
  );
}