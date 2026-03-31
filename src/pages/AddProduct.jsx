// Pages/AddProduct.jsx - MAIN PAGE (REDUCED)
import { useEffect, useMemo, useState } from "react";
import AddProductHeader from "../components/AddProductHeader.jsx";
import FormSections from "./Product/FormSections.jsx";
import SubmitBar from "./Product/SubmitBar.jsx";
import "./AddProduct.css";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  attributes: {
    brand: "",
    model: "",
    color: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    sim: "",
    year: "",
    engine: "",
    fuel_type: "",
    features: [],
  },
  delivery: {
    available: true,
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    email: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= PERSIST PAYMENT DATA ================= */
  useEffect(() => {
    const saved = localStorage.getItem("payment_retry");
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem("payment_retry", JSON.stringify(paymentData));
    }
  }, [paymentData]);

  /* ================= SHARED COMPUTED VALUES ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const { locationsByState, promotionPlans } = await import("../config"); // Dynamic import for tree-shaking
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  /* ================= SHARED UPDATERS ================= */
  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    }));
  const updateContact = (key, value) =>
    setForm((p) => ({ ...p, contact: { ...p.contact, [key]: value } }));
  const updateDelivery = (key, value) =>
    setForm((p) => ({ ...p, delivery: { ...p.delivery, [key]: value } }));
  const updateDeliveryDuration = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, duration: { ...p.delivery.duration, [key]: value } },
    }));

  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists ? list.filter((f) => f !== feature) : [...list, feature],
        },
      };
    });
  };

  /* ================= SHARED HOOKS & VALIDATION ================= */
  const validate = () => {
    if (form.title.length < 10) return "Title too short";
    if (form.description.length < 20) return "Description too short";
    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone) return "Phone required";
    if (!form.contact.email) return "Email required";
    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Delivery range required";
      if (to < from) return "Invalid delivery range";
    }
    return null;
  };

  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);
    previews.forEach(URL.revokeObjectURL);
    setImages(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, x) => x !== i);
    });
  };

  /* ================= SHARED PROPS ================= */
  const sharedProps = {
    form,
    categories,
    selectedCategory,
    state,
    setState,
    city,
    setCity,
    images,
    previews,
    update,
    updateAttr,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    handleImages,
    removeImage,
    validate,
  };

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />
      <FormSections {...sharedProps} />
      <SubmitBar
        {...sharedProps}
        loading={loading}
        setLoading={setLoading}
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        paymentData={paymentData}
        setPaymentData={setPaymentData}
        images={images}
        states={states}
        cities={cities}
        promotionPlans={promotionPlans}
      />
    </div>
  );
}