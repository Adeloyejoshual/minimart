// src/pages/Marketplace/AddProduct.jsx

import { useState, useRef, useCallback, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import "./AddProduct.css";

/* ---------------- CONFIG ---------------- */
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

/* ---------------- SECTIONS ---------------- */
import ProductDetailsSection from "../../components/AddProduct/ProductDetailsSection";
import PricingBoostSection from "../../components/AddProduct/PricingBoostSection";
import DescriptionMediaSection from "../../components/AddProduct/DescriptionMediaSection";
import DeliveryContactSection from "../../components/AddProduct/DeliveryContactSection";

/* ---------------- UTIL ---------------- */

const initializeForm = (user) => ({
  title: "",
  description: "",
  price: "",
  discount_price: "",
  category: "",
  subcategory: "",
  brand: "",
  model: "",
  condition: "",
  used_detail: "",
  ram: "",
  storage: "",
  color: "",
  sim: [],
  features: [],
  engine: "",
  mileage: "",
  year: "",
  fuel_type: "",
  transmission: "",
  phone_number: user?.phone_number || "",
  additional_phone: "",
  poster_name: user?.name || "",
  state: "",
  city: "",
  social_link: "",
  images: [],
  video_link: "",
  promoted: false,
  promo_plan: "",
  flash_sale: false,
  exchange_possible: false,
  negotiable: false,
  deliveryRegions: []
});

export default function AddMarketplaceProduct() {
  const { user, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);

  /* ---------------- STATE ---------------- */

  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });

  const [deliveryForm, setDeliveryForm] = useState({
    state: "",
    city: "",
    method: "Courier",
    from: "",
    to: "",
    chargeFee: false,
    fee: "",
    expressAvailable: false,
    warehouseAddress: ""
  });

  const [ui, setUi] = useState({
    loading: false,
    showPreview: false,
    showPayment: false,
    errors: {}
  });

  /* ---------------- COMPUTED ---------------- */

  const currentPlan = useMemo(
    () => promotionPlans.find((p) => p.id === form.promo_plan),
    [form.promo_plan]
  );

  const computed = useMemo(() => {
    const baseFields = categoryFields[form.category] || [];

    return {
      visibleFields: baseFields.filter(
        (field) => field !== "used_detail" || form.condition === "Used"
      ),
      availableBrands: brands[form.category] || [],
      availableModels: form.brand
        ? models[form.category]?.[form.brand] || []
        : [],
      categoryFeatures: featuresByCategory[form.category] || [],
      availableCities: locationsByState[form.state] || [],
      currentPlan,
      paystackKey:
        import.meta.env.MODE === "production"
          ? import.meta.env.VITE_PAYSTACK_LIVE_KEY
          : import.meta.env.VITE_PAYSTACK_TEST_KEY,
      cleanPrice: Number(form.price.replace(/,/g, "")),
      imageCount: images.files.length,
      apiUrl: import.meta.env.VITE_API_URL || "/api/marketplace"
    };
  }, [form, images.files.length, currentPlan]);

  /* ---------------- HANDLERS ---------------- */

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setUi((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: "" }
    }));
  }, []);

  const handlePriceInput = useCallback(
    (value) => {
      const num = value.replace(/[^0-9]/g, "");
      handleChange("price", num ? Number(num).toLocaleString() : "");
    },
    [handleChange]
  );

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    setUi((prev) => ({ ...prev, showPreview: true }));
  }, []);

  const finalPublish = useCallback(async () => {
    setUi((prev) => ({ ...prev, loading: true }));

    try {
      const token = await getAccessTokenSilently();

      const response = await fetch(computed.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) throw new Error("Publish failed");

      alert("✅ Product published successfully!");
    } catch (err) {
      console.error(err);
      alert("❌ Publish failed");
    } finally {
      setUi((prev) => ({ ...prev, loading: false }));
    }
  }, [form, computed.apiUrl, getAccessTokenSilently]);

  const confirmPublish = useCallback(async () => {
    setUi((prev) => ({ ...prev, showPreview: false }));

    if (form.promoted && currentPlan?.price > 0) {
      setUi((prev) => ({ ...prev, showPayment: true }));
    } else {
      await finalPublish();
    }
  }, [form.promoted, currentPlan, finalPublish]);

  /* ---------------- RENDER ---------------- */

  return (
    <div className="marketplace-form">
      <h1 className="form-title">🚀 Post New Marketplace Product</h1>

      <form onSubmit={handleSubmit}>
        <div className="step-content-wrapper">
          <ProductDetailsSection
            form={form}
            ui={ui}
            computed={computed}
            handleChange={handleChange}
          />

          <PricingBoostSection
            form={form}
            computed={computed}
            handleChange={handleChange}
            handlePriceInput={handlePriceInput}
          />

          <DescriptionMediaSection
            form={form}
            images={images}
            setImages={setImages}
            fileInputRef={fileInputRef}
            ui={ui}
          />

          <DeliveryContactSection
            form={form}
            deliveryForm={deliveryForm}
            setDeliveryForm={setDeliveryForm}
            ui={ui}
            handleChange={handleChange}
          />
        </div>

        <div className="step-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={ui.loading}
          >
            🚀 Preview & Publish
          </button>
        </div>
      </form>

      {ui.showPreview && (
        <div className="preview-modal">
          <h3>Preview</h3>

          <button
            onClick={confirmPublish}
            className="btn btn-success-large"
          >
            {form.promoted && currentPlan?.price > 0
              ? "💳 Pay & Publish"
              : "✅ Publish Now"}
          </button>
        </div>
      )}
    </div>
  );
}