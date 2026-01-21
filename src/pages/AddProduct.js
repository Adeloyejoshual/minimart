// src/pages/AddProduct.js
import { useEffect, useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate } from "react-router-dom";
import { promotionPlans } from "../config/promotionPlans";
import Toast from "../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";

export default function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [form, setForm] = useState({
    title: "",
    price: "",
    phone: "",
    images: [],
    previews: [],
    isPromoted: false,
    promotionPlan: null,
    paymentSuccess: false, // Track if user paid promotion
  });

  const [paystackLoaded, setPaystackLoaded] = useState(false);

  // ---------------- Load Draft ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  // ---------------- Load Paystack ----------------
  useEffect(() => {
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => setPaystackLoaded(true);
      document.body.appendChild(script);
    } else {
      setPaystackLoaded(true);
    }
  }, []);

  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleImages = files => {
    const list = Array.from(files);
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title) return "Enter title";
    if (!form.price) return "Enter price";
    if (!form.phone) return "Enter phone";
    if (!form.images.length) return "Upload at least 1 image";
    return null;
  };

  // ---------------- Post Product ----------------
  const postProduct = async () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");

    try {
      setLoading(true);
      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(String(form.price).replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        promotion: form.isPromoted
          ? {
              id: form.promotionPlan.id,
              label: form.promotionPlan.label,
              price: form.promotionPlan.price,
              days: form.promotionPlan.days,
              startAt: serverTimestamp(),
              endAt: new Date(Date.now() + form.promotionPlan.days * 24 * 60 * 60 * 1000),
            }
          : null,
      });

      localStorage.removeItem(DRAFT_KEY);
      showToast("Product posted successfully!", "✅");
      navigate("/");
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Paystack ----------------
  const payWithPaystack = (plan) => {
    if (!paystackLoaded) return showToast("Paystack not loaded yet", "❌");
    if (!window.PaystackPop) return showToast("Paystack not available", "❌");

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY,
      email: auth.currentUser.email,
      amount: plan.price * 100,
      currency: "NGN",
      ref: `promo_${Date.now()}`,
      metadata: { promotionPlanId: plan.id },
      callback: () => {
        showToast("Payment successful! 🎉", "✅");
        update("isPromoted", true);
        update("promotionPlan", { ...plan, paid: true });
        update("paymentSuccess", true); // mark that user can continue posting
      },
      onClose: () => showToast("Payment cancelled", "❌"),
    });

    handler.openIframe();
  };

  // ---------------- Handle Promotion Click ----------------
  const handlePromotionClick = (plan) => {
    update("promotionPlan", plan);
    if (plan.type === "paid" && !plan.paid) {
      payWithPaystack(plan);
    } else {
      update("isPromoted", true);
      update("paymentSuccess", true);
      showToast(`${plan.label} selected!`, "⚡");
    }
  };

  // ---------------- Handle Publish ----------------
  const handlePublish = () => {
    if (form.promotionPlan?.type === "paid" && !form.paymentSuccess) {
      return showToast("Complete payment before posting", "⚠️");
    }
    postProduct();
  };

  // ---------------- Render ----------------
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Product title" />
      </Field>

      <Field label="Price (₦)">
        <input value={form.price} onChange={e => update("price", e.target.value)} placeholder="₦0" />
      </Field>

      <Field label="Phone Number">
        <input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />
      </Field>

      <Field label="Images">
        <label className="image-upload">
          <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />
          <span>＋ Add Images</span>
        </label>
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Promotion Plan">
        <div className="promotion-scroll">
          {promotionPlans.map(plan => (
            <div
              key={plan.id}
              className={`promotion-item ${form.promotionPlan?.id === plan.id ? "active" : ""}`}
              onClick={() => handlePromotionClick(plan)}
            >
              <span className="promotion-icon">{plan.icon}</span>
              <span>{plan.label}</span>
              <span>{plan.days} days</span>
              <span>{plan.price > 0 ? `₦${plan.price}` : "Free"}</span>
            </div>
          ))}
        </div>
        {form.paymentSuccess && <div className="payment-success">Payment successful! You can now publish your product ✅</div>}
      </Field>

      <button className="btn" type="button" onClick={handlePublish} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}

// ---------------- Field ----------------
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);