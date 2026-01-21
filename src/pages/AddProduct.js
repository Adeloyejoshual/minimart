// src/pages/AddProduct.js
import { useEffect, useState, useRef } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  deleteDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import productOptions from "../config/productOptions";
import phoneModels from "../config/phoneModels";
import { promotionPlans } from "../config/promotionPlans";
import Toast from "../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";
const PENDING_PAYMENT_COLLECTION = "pending_payments";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);

  const [form, setForm] = useState({
    title: "",
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    price: "",
    phone: "",
    description: "",
    state: "",
    city: "",
    images: [],
    previews: [],
    color: "",
    simType: "",
    features: [],
    type: "",
    isPromoted: false,
    promotionPlan: null,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  // ---------------- Draft Load/Save ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));
    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat }));
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) localStorage.setItem(CATEGORY_KEY, form.mainCategory);
  }, [form]);

  useEffect(() => {
    return () => form.previews.forEach(url => URL.revokeObjectURL(url));
  }, [form.previews]);

  // ---------------- Load Pending Payment ----------------
  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchPending = async () => {
      const docRef = doc(db, PENDING_PAYMENT_COLLECTION, auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setPendingPayment(docSnap.data());
    };
    fetchPending();
  }, [auth.currentUser]);

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Helpers ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      return showToast(`Maximum ${rules.maxImages} images allowed`, "⚠️");
    }
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  // ---------------- Validation ----------------
  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;
    if (["Smartphones", "Feature Phones"].includes(form.subCategory) && form.model && !form.condition)
      return "Select condition";
    if (form.condition === "Used" && !form.usedDetail) return "Select used detail";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
  };

  // ---------------- Save Pending Payment ----------------
  const savePendingPayment = async () => {
    if (!auth.currentUser) return;
    await setDoc(doc(db, PENDING_PAYMENT_COLLECTION, auth.currentUser.uid), {
      productData: form,
      plan: form.promotionPlan,
      createdAt: serverTimestamp(),
    });
  };

  // ---------------- Paystack Payment ----------------
  const payWithPaystack = (plan) => {
    if (!auth.currentUser) return showToast("Login required", "🔒");

    // Save pending before opening payment
    savePendingPayment();

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY,
      email: auth.currentUser.email,
      amount: plan.price * 100,
      currency: "NGN",
      callback: async () => {
        update("promotionPlan", { ...plan, paid: true });
        showToast("Promotion activated 🎉", "⚡");

        // After successful payment, submit product and remove pending
        await handleSubmit(true);
        await deleteDoc(doc(db, PENDING_PAYMENT_COLLECTION, auth.currentUser.uid));
      },
      onClose: () => showToast("Payment cancelled", "❌"),
    });
    handler.openIframe();
  };

  // ---------------- Submit ----------------
  const handleSubmit = async (afterPayment = false) => {
    const error = validate();
    if (error) return showToast(error, "⚠️");
    if (!auth.currentUser) return showToast("Login required", "🔒");

    // Paid promotion check
    if (!afterPayment && form.isPromoted && form.promotionPlan?.type === "paid" && !form.promotionPlan?.paid) {
      return payWithPaystack(form.promotionPlan);
    }

    try {
      setLoading(true);

      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      const promotionEndAt = form.promotionPlan
        ? new Date(Date.now() + form.promotionPlan.days * 24 * 60 * 60 * 1000)
        : null;

      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(String(form.price).replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        promotion: form.isPromoted
          ? {
              id: form.promotionPlan?.id,
              label: form.promotionPlan?.label,
              icon: form.promotionPlan?.icon,
              price: form.promotionPlan?.price,
              days: form.promotionPlan?.days,
              startAt: serverTimestamp(),
              endAt: promotionEndAt,
            }
          : null,
      });

      localStorage.removeItem(DRAFT_KEY);
      showToast("Product posted successfully!", "✅");
      navigate(`/${marketType}`);
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- FullPage Selector ----------------
  const FullPageList = ({ title, options, valueKey }) => {
    const [search, setSearch] = useState("");
    const [customValue, setCustomValue] = useState("");
    const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    const handleCustomSubmit = () => {
      if (customValue.trim() !== "") {
        update(valueKey, customValue.trim());
        setCustomValue("");
        setSelectionStep(null);
        window.scrollTo(0, scrollPos.current);
      }
    };

    return (
      <div className="fullpage-list">
        {backStep && <div className="options-back" onClick={() => setSelectionStep(backStep)}>← Back</div>}
        <h3>{title}</h3>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="fullpage-search"
        />
        <div className="options-scroll">
          {filtered.map(opt => (
            <div
              key={opt}
              className={`option-item ${form[valueKey] === opt ? "active" : ""}`}
              onClick={() => { update(valueKey, opt); setSelectionStep(null); window.scrollTo(0, scrollPos.current); }}
            >
              {opt}
            </div>
          ))}
          <div className="option-item custom-input">
            <input
              type="text"
              placeholder={`Enter ${valueKey}...`}
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustomSubmit()}
            />
          </div>
        </div>
      </div>
    );
  };

  // ---------------- Render Main Form ----------------
  return (
    <div className="add-product-container">
      {pendingPayment && !form.promotionPlan?.paid && (
        <div className="pending-payment-banner">
          ⚠️ You have a pending payment for a product.
          <button className="btn-small" onClick={() => payWithPaystack(pendingPayment.plan)}>
            Retry Payment
          </button>
        </div>
      )}

      {/* ... All other fields unchanged ... */}
      {/* Keep your original form fields here (Title, Category, Brand, Model, Price, Phone, Images, Promotion, etc.) */}
    </div>
  );
}

// ---------------- Field Component ----------------
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);