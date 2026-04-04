import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "./AddProduct.css";

/* ================= INITIAL FORM ================= */
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

  /* ================= FLATTEN CATEGORY TREE ================= */
  const flattenCategories = (nodes) =>
    nodes.flatMap((node) => [
      { id: node.id, name: node.name },
      ...flattenCategories(node.subcategories || []),
    ]);

  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories]
  );

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then((data) => {
        const tree = Array.isArray(data) ? data : data.tree || [];
        setCategories(Array.isArray(tree) ? tree : []);
      })
      .catch((err) => {
        console.error("Failed to fetch categories:", err);
      });
  }, []);

  /* ================= PAYMENT RETRY (localStorage) ================= */
  useEffect(() => {
    const saved = localStorage.getItem("payment_retry");
    if (saved) setPaymentData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (paymentData) {
      localStorage.setItem("payment_retry", JSON.stringify(paymentData));
    } else {
      localStorage.removeItem("payment_retry");
    }
  }, [paymentData]);

  /* ================= SELECTED CATEGORY & OPTIONS ================= */
  const selectedCategory = useMemo(
    () =>
      flatCategories.find((c) => String(c.id) === String(form.category_id)),
    [flatCategories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};

  const attributes = form.attributes;
  const brand = attributes.brand;

  /* ================= HELPERS ================= */
  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  const onlyNumbers = (v = "") => v.replace(/[^0-9]/g, "");

  const formatLabel = (t) =>
    t
      .replace(/_/g, " ")
      .replace(/\bw/g, (l) => l.toUpperCase());

  /* ================= OPTIONS MAP ================= */
  const optionsMap = useMemo(() => {
    const modelsForBrand =
      brand && options.models?.[brand] ? options.models[brand] : [];

    return {
      brand: normalizeOptions(options.brands),
      model: normalizeOptions(modelsForBrand),
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sims),
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines),
      fuel_type: normalizeOptions(options.fuel_types),
    };
  }, [options, brand]);

  const fields = useMemo(() => {
    const dynamic = options.fields?.map?.((f) => f.name) || [];
    return dynamic.includes("condition")
      ? dynamic
      : ["condition", ...dynamic];
  }, [options]);

  /* ================= UPDATE HELPERS ================= */
  const update = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }), // reset model when brand changes
      },
    }));

  const updateContact = (key, value) =>
    setForm((p) => ({
      ...p,
      contact: { ...p.contact, [key]: value },
    }));

  const updateDelivery = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [key]: value },
    }));

  const updateDeliveryDuration = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [key]: value },
      },
    }));

  /* ================= FEATURES ================= */
  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = Array.isArray(p.attributes.features)
        ? p.attributes.features
        : [];
      const exists = list.includes(feature);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? list.filter((f) => f !== feature)
            : [...list, feature],
        },
      };
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.trim().length < 10)
      return "Title too short (min 10 characters)";
    if (form.description.trim().length < 20)
      return "Description too short (min 20 characters)";
    if (!form.price || onlyNumbers(form.price) === "")
      return "Price required";
    if (!form.category_id)
      return "Select a category";

    const cleanPhone = onlyNumbers(form.contact.phone);
    if (!/^d{10,15}$/.test(cleanPhone))
      return "Phone must be 10–15 digits";

    if (
      form.contact.email &&
      !/^S+@S+.S+$/.test(form.contact.email)
    )
      return "Valid email required";

    if (form.delivery.available) {
      const from = Number(onlyNumbers(form.delivery.duration.from));
      const to = Number(onlyNumbers(form.delivery.duration.to));

      if (Number.isNaN(from) || Number.isNaN(to))
        return "Delivery range required";

      if (to < from)
        return "Invalid delivery range (to must be >= from)";
    }

    return null;
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    if (files.length > 8) {
      alert("Max 8 images allowed");
      return;
    }

    const list = Array.from(files).slice(0, 8);

    previews.forEach((url) => URL.revokeObjectURL(url));

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

  /* ================= RETRY PAYMENT ================= */
  const retryPayment = async () => {
    if (!paymentData) {
      alert("No pending payment to retry");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: paymentData.email,
            amount: Number(paymentData.amount) * 100,
            plan_id: paymentData.plan_id,
            product_id: paymentData.product_id,
          }),
        }
      );

      const data = await res.json();

      if (!data.success || !data.authorization_url) {
        setLoading(false);
        return alert(data.message || "Payment initialization failed");
      }

      setPaymentData(null);
      localStorage.removeItem("payment_retry");

      window.location.href = data.authorization_url;
    } catch (err) {
      console.error("retryPayment error:", err);
      alert("Retry failed – check network and try again");
      setLoading(false);
    }
  };

  /* ================= SUBMIT + PAY ================= */
  const handleSubmit = async () => {
    if (loading || !form.category_id) return;

    const err = validate();
    if (err) return alert(err);

    // Pick plan or fallback to free
    const finalPlan =
      selectedPlan ||
      promotionPlans.find((p) => Number(p.price) === 0);

    if (!finalPlan) {
      return alert("No promotion plan available");
    }

    setLoading(true);

    const fd = new FormData();

    const cleanPrice = Number(onlyNumbers(form.price));
    const cleanFrom = Number(onlyNumbers(form.delivery.duration.from));
    const cleanTo = Number(onlyNumbers(form.delivery.duration.to));

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: cleanPrice,
      category_id: form.category_id,

      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify({
        ...form.delivery,
        duration: {
          from: cleanFrom,
          to: cleanTo,
        },
      }),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      plan_id: finalPlan.id,
    };

    // Append payload fields
    Object.entries(payload).forEach(([key, value]) => {
      fd.append(key, value);
    });

    // Append images
    images.forEach((img) => {
      fd.append("images", img);
    });

    try {
      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: fd }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const result = await res.json();
      const productId = result?.product?.id || result?.id;

      if (!productId) {
        setLoading(false);
        return alert("Product created but ID is missing; contact admin.");
      }

      // If it's free, mark as “active”
      if (Number(finalPlan.price) === 0) {
        alert("✅ Product created and published (no payment needed)");

        setForm(INITIAL_FORM);
        setImages([]);
        setPreviews([]);
        setState("");
        setCity("");
        setSelectedPlan(null);
        setPaymentData(null);

        setLoading(false);
        return;
      }

      // Otherwise, go to Paystack
      const payRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/payment/initialize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.contact.email,
            amount: Number(finalPlan.price) * 100,
            plan_id: finalPlan.id,
            product_id: productId,
          }),
        }
      );

      const payData = await payRes.json();

      if (!payData.success || !payData.authorization_url) {
        // Save payload so user can retry
        setPaymentData({
          email: form.contact.email,
          amount: Number(finalPlan.price),
          plan_id: finalPlan.id,
          product_id: productId,
        });

        setLoading(false);
        alert(
          "Payment failed – you can retry later with the 'Retry Payment' button"
        );
        return;
      }

      setPaymentData(null);
      localStorage.removeItem("payment_retry");

      window.location.href = payData.authorization_url;
    } catch (err) {
      console.error("AddProduct handleSubmit error:", err);
      alert(
        "Something went wrong. Please check your internet and try again."
      );
      setLoading(false);
    }
  };

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) => update("price", onlyNumbers(e.target.value))}
      />

      <input
        placeholder="Email"
        value={form.contact.email}
        onChange={(e) => updateContact("email", e.target.value)}
      />

      {/* ================= CATEGORY DROPDOWN ================= */}
      <DropdownModal
        label="Category"
        value={form.category_id || ""}
        onChange={(v) =>
          setForm((prev) => ({
            ...prev,
            category_id: v,
            attributes: INITIAL_FORM.attributes,
          }))
        }
        options={flatCategories}
        placeholder="Select category"
      />

      {/* ================= DYNAMIC FIELDS (from category) ================= */}
      {fields.map((f) => {
        if (!optionsMap[f]) return null;
        if (f === "used_detail" && attributes.condition !== "Used") return null;

        return (
          <DropdownModal
            key={f}
            label={formatLabel(f)}
            value={attributes[f] || ""}
            onChange={(v) => updateAttr(f, v)}
            options={optionsMap[f]}
            placeholder={`Select ${formatLabel(f)}`}
          />
        );
      })}

      {/* ================= FEATURES ================= */}
      {Array.isArray(options.features) && (
        <div className="form-section">
          <h3>Features</h3>
          <div className="checkbox-grid">
            {options.features.map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={(attributes.features || []).includes(f)}
                  onChange={() => toggleFeature(f)}
                />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ================= LOCATION ================= */}
      <DropdownModal
        label="State"
        value={state}
        onChange={setState}
        options={normalizeOptions(states)}
        placeholder="Select state"
      />

      {state && (
        <DropdownModal
          label="City"
          value={city}
          onChange={setCity}
          options={normalizeOptions(cities)}
          placeholder="Select city"
        />
      )}

      {/* ================= PHONE & UPLOADS ================= */}
      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          updateContact("phone", onlyNumbers(e.target.value))
        }
      />

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i} className="preview-item">
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      {/* ================= PROMOTION PLANS ================= */}
      <div className="form-section">
        <h3>Promotion Plans</h3>
        {promotionPlans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            style={{
              border:
                selectedPlan?.id === plan.id
                  ? "2px solid green"
                  : "1px solid #ccc",
              padding: "10px",
              borderRadius: "8px",
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            <strong>{plan.name}</strong>
            <p style={{ margin: "4px 0 0" }}>{plan.duration}</p>
            <p style={{ margin: "4px 0 0" }}>
              ₦{Number(plan.price).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: "20px",
        }}
      >
        {loading ? "Processing..." : "Pay & Create Product"}
      </button>

      {paymentData && !loading && (
        <button
          onClick={retryPayment}
          style={{
            marginTop: "10px",
            background: "#f59e0b",
            color: "#fff",
            padding: "8px 16px",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Retry Payment
        </button>
      )}
    </div>
  );
}