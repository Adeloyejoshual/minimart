// src/pages/AddProduct.js
import { useEffect, useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { promotionPlans } from "../config/promotionPlans";
import Toast from "../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";

export default function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    images: [],
    previews: [],
    promotionPlan: null,
    isPromoted: false,
  });

  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [loading, setLoading] = useState(false);
  const scrollPos = useRef(0);

  // ---------------- Draft Load ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));
  }, []);

  // ---------------- Draft Save ----------------
  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  };

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Helpers ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleImages = (files) => {
    const list = Array.from(files);
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title) return "Enter title";
    if (form.images.length === 0) return "Add at least one image";
    if (!form.promotionPlan) return "Select promotion plan";
    return null;
  };

  // ---------------- Paystack Payment ----------------
  const payWithPaystack = (plan) => {
    if (!window.PaystackPop) return showToast("Paystack not loaded", "❌");

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY,
      email: auth.currentUser.email,
      amount: plan.price * 100,
      currency: "NGN",
      ref: `promo_${Date.now()}`,
      metadata: { promotionPlanId: plan.id },
      callback: async () => {
        showToast("Payment successful! Posting product...", "✅");
        await postProduct(); // after payment, post
      },
      onClose: () => showToast("Payment cancelled", "❌"),
    });

    handler.openIframe();
  };

  // ---------------- Post Product ----------------
  const postProduct = async () => {
    try {
      setLoading(true);

      // Upload images
      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      // Save to Firestore
      await addDoc(collection(db, "products"), {
        title: form.title,
        images: uploaded,
        coverImage: uploaded[0],
        promotion: form.isPromoted ? form.promotionPlan : null,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);
      showToast("Product posted successfully! 🎉", "✅");
      setForm({ title: "", images: [], previews: [], promotionPlan: null, isPromoted: false });
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Publish Button ----------------
  const handlePublish = () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");

    saveDraft(); // save draft before payment

    if (form.promotionPlan.type === "paid") {
      payWithPaystack(form.promotionPlan);
    } else {
      postProduct(); // free promotion
    }
  };

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Product Title" />
      </div>

      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="images-preview">
          {form.previews.map((p, i) => (
            <div key={i}>
              <img src={p} alt={`preview-${i}`} width={80} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Promotion Plan</label>
        <div className="promotion-scroll">
          {promotionPlans.map(plan => (
            <div
              key={plan.id}
              className={`promotion-item ${form.promotionPlan?.id === plan.id ? "active" : ""}`}
              onClick={() => update("promotionPlan", plan)}
            >
              <span>{plan.icon}</span> {plan.label} ({plan.days} days) {plan.price > 0 ? `₦${plan.price}` : "Free"}
            </div>
          ))}
        </div>
      </div>

      <button className="btn" type="button" onClick={handlePublish} disabled={loading}>
        {loading ? "Processing..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}