// src/pages/TestPromotion.js
import { useState, useEffect } from "react";
import { uploadToCloudinary } from "../cloudinary";
import { promotionPlans } from "../config/promotionPlans";
import Toast from "../components/Toast";
import { auth } from "../firebase";

export default function TestPromotion() {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [paystackReady, setPaystackReady] = useState(false);

  // Load Paystack
  useEffect(() => {
    if (window.PaystackPop) return setPaystackReady(true);
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => setPaystackReady(true);
    document.body.appendChild(script);
  }, []);

  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  const handleImage = (file) => {
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const payWithPaystack = (plan) => {
    if (!paystackReady) return showToast("Initializing Paystack...", "⚡");
    if (!auth.currentUser) return showToast("Login required for payment", "🔒");

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY, // your public key
      email: auth.currentUser.email,
      amount: plan.price * 100,
      currency: "NGN",
      ref: `promo_${Date.now()}`,
      callback: () => {
        showToast(`Payment successful! ${plan.label} activated 🎉`, "✅");
      },
      onClose: () => showToast("Payment cancelled", "❌"),
    });

    handler.openIframe();
  };

  const handlePromotionClick = (plan) => {
    if (plan.type === "paid" && plan.price > 0) {
      payWithPaystack(plan);
    } else {
      showToast(`${plan.label} selected (free) ⚡`, "✅");
    }
  };

  const handleSubmit = async () => {
    if (!title) return showToast("Enter a title", "⚠️");
    if (!image) return showToast("Upload an image", "⚠️");

    const uploaded = await uploadToCloudinary(image);
    showToast(`Uploaded successfully! URL: ${uploaded}`, "✅");
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "auto" }}>
      <h2>Test Add Product + Promotion</h2>

      <div>
        <label>Title:</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter product title"
          style={{ width: "100%", padding: 8, margin: "8px 0" }}
        />
      </div>

      <div>
        <label>Image:</label>
        <input type="file" onChange={e => handleImage(e.target.files[0])} />
        {preview && <img src={preview} alt="preview" style={{ width: 100, marginTop: 8 }} />}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Promotion Plans:</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {promotionPlans.map(plan => (
            <button
              key={plan.id}
              style={{ padding: 10 }}
              onClick={() => handlePromotionClick(plan)}
            >
              {plan.icon} {plan.label} - {plan.price > 0 ? `₦${plan.price}` : "Free"} ({plan.days} days)
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        style={{ marginTop: 20, padding: 10, width: "100%" }}
      >
        Submit
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}