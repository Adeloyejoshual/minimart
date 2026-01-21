import { useEffect } from "react";

export default function AddProduct() {
  useEffect(() => {
    // Load Paystack script
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;

      script.onload = () => openPaystack();
      document.body.appendChild(script);
    } else {
      openPaystack();
    }
  }, []);

  const openPaystack = () => {
    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY, // LIVE KEY
      email: "customer@email.com",
      amount: 1000 * 100, // ₦1,000
      currency: "NGN",

      callback: function (response) {
        alert("Payment successful ✅");
        console.log("REFERENCE:", response.reference);
      },

      onClose: function () {
        alert("Payment cancelled ❌");
      },
    });

    handler.openIframe();
  };

  return null; // nothing renders
}