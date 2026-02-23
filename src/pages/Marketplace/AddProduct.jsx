// src/pages/Marketplace/AddMarketplaceProduct.jsx
// ✅ PRODUCTION DISTRIBUTED-SAFE VERSION

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect
} from "react";
import { useAuth0 } from "@auth0/auth0-react";

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

/* ---------------- CONSTANTS ---------------- */

const STORAGE_KEYS = {
  DRAFT: "marketplace_draft_v11",
  IDEMPOTENCY: "marketplace_idempotency_v11"
};

const MAX_FILE_SIZE = 5_000_000;
const MAX_IMAGES = 10;
const CONCURRENT_UPLOADS = 3;
const QUEUE_TIMEOUT = 15000;
const MAX_PRICE = 999_999_999_999;

const apiUrl = import.meta.env.VITE_API_URL || "/api/marketplace";
const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
}/image/upload`;

/* ---------------- UTIL ---------------- */

const extractDigits = (value = "") =>
  value.replace(/[^\d]/g, "");

const timeout = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );

const decodeJWT = (token) => {
  try {
    const base64Url = token.split(".")[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    base64 += "=".repeat((4 - base64.length % 4) % 4);
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

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

/* =====================================================
   COMPONENT
===================================================== */

export default function AddMarketplaceProduct() {
  const { user, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);

  /* ---------------- REFS ---------------- */

  const publishLockRef = useRef(false);
  const abortControllerRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const tokenRef = useRef({ token: null, expiresAt: 0 });
  const uploadedPublicIdsRef = useRef([]);
  const publishStatusRef = useRef("idle");
  const consecutiveErrorsRef = useRef(0);

  const sessionIdRef = useRef(
    crypto.randomUUID?.() ||
      Array.from(new Uint32Array(4), b =>
        b.toString(16).padStart(2, "0")
      ).join("")
  );

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
    errors: {},
    publishStatus: "idle",
    currentIdempotency: null
  });

  useEffect(() => {
    publishStatusRef.current = ui.publishStatus;
  }, [ui.publishStatus]);

  /* ---------------- PRICE ---------------- */

  const cleanPrice = useMemo(() => {
    const n = Number(extractDigits(form.price));
    return n > 0 && n <= MAX_PRICE ? n : 0;
  }, [form.price]);

  /* ---------------- TOKEN ---------------- */

  const getToken = useCallback(async () => {
    const now = Date.now();

    if (
      tokenRef.current.token &&
      tokenRef.current.expiresAt > now + 60000
    ) {
      return tokenRef.current.token;
    }

    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "write:products"
      }
    });

    const payload = decodeJWT(token);
    const expiresAt = payload?.exp
      ? payload.exp * 1000
      : now + 5 * 60 * 1000;

    tokenRef.current = { token, expiresAt };
    return token;
  }, [getAccessTokenSilently]);

  /* ---------------- IDEMPOTENCY ---------------- */

  const getOrCreateIdempotency = useCallback(() => {
    if (ui.currentIdempotency) return ui.currentIdempotency;

    const array = new Uint32Array(8);
    crypto.getRandomValues(array);

    const key = `${sessionIdRef.current}-${Array.from(
      array,
      b => b.toString(16).padStart(2, "0")
    ).join("")}`;

    setUi(prev => ({ ...prev, currentIdempotency: key }));
    return key;
  }, [ui.currentIdempotency]);

  /* ---------------- CLEANUP ---------------- */

  const cleanupPartialUploads = useCallback(async () => {
    const publicIds = [...uploadedPublicIdsRef.current];
    if (!publicIds.length) return;

    uploadedPublicIdsRef.current = [];

    try {
      const token = await getToken();
      await fetch(`${apiUrl}/cleanup/images`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          public_ids: publicIds,
          session_id: sessionIdRef.current
        })
      });
    } catch {
      uploadedPublicIdsRef.current = publicIds;
    }
  }, [getToken]);

  /* ---------------- UPLOAD ---------------- */

  const uploadImages = useCallback(async () => {
    abortControllerRef.current = new AbortController();
    const results = { urls: [], publicIds: [] };

    const chunks = [];
    for (let i = 0; i < images.files.length; i += CONCURRENT_UPLOADS) {
      chunks.push(images.files.slice(i, i + CONCURRENT_UPLOADS));
    }

    for (const chunk of chunks) {
      const settled = await Promise.allSettled(
        chunk.map(file => {
          if (file.size > MAX_FILE_SIZE)
            throw new Error("File too large");

          const fd = new FormData();
          fd.append("file", file);
          fd.append(
            "upload_preset",
            import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
          );

          return fetch(cloudinaryUrl, {
            method: "POST",
            body: fd,
            signal: abortControllerRef.current.signal
          });
        })
      );

      const rejected = settled.find(r => r.status === "rejected");
      if (rejected) {
        abortControllerRef.current.abort();
        await cleanupPartialUploads();
        throw new Error("Upload failed");
      }

      for (const s of settled) {
        const res = s.value;
        const data = await res.json();

        if (!res.ok || data.error) {
          abortControllerRef.current.abort();
          await cleanupPartialUploads();
          throw new Error("Upload error");
        }

        uploadedPublicIdsRef.current.push(data.public_id);
        results.urls.push(data.secure_url);
        results.publicIds.push(data.public_id);
      }
    }

    return results;
  }, [images.files, cleanupPartialUploads]);

  /* ---------------- POLLING ---------------- */

  const startPolling = useCallback((key) => {
    consecutiveErrorsRef.current = 0;
    const startTime = Date.now();
    let backoffIndex = 0;
    const intervals = [2000, 3000, 5000, 8000, 13000];

    const poll = async () => {
      if (publishStatusRef.current !== "processing") return;

      if (Date.now() - startTime > 60000) {
        setUi(prev => ({
          ...prev,
          publishStatus: "timeout",
          loading: false
        }));
        return;
      }

      const interval = intervals[backoffIndex] || 13000;

      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/status/${key}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const status = await res.json();

        if (status.completed) {
          setUi(prev => ({
            ...prev,
            publishStatus: "success",
            loading: false,
            currentIdempotency: null
          }));
          return;
        }

        if (status.failed) {
          setUi(prev => ({
            ...prev,
            publishStatus: "failed",
            loading: false
          }));
          return;
        }

        backoffIndex = Math.min(backoffIndex + 1, 4);
        pollTimeoutRef.current = setTimeout(poll, interval);

      } catch {
        consecutiveErrorsRef.current += 1;

        if (consecutiveErrorsRef.current >= 3) {
          setUi(prev => ({
            ...prev,
            publishStatus: "error",
            loading: false
          }));
          return;
        }

        pollTimeoutRef.current = setTimeout(poll, interval);
      }
    };

    poll();
  }, [getToken]);

  /* ---------------- HANDLE PUBLISH ---------------- */

  const handlePublish = useCallback(async () => {
    if (publishLockRef.current || ui.loading) return;

    publishLockRef.current = true;
    setUi(prev => ({
      ...prev,
      loading: true,
      publishStatus: "uploading"
    }));

    try {
      const { urls, publicIds } = await uploadImages();
      const key = getOrCreateIdempotency();
      const token = await getToken();

      const response = await Promise.race([
        fetch(`${apiUrl}/queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            ...form,
            price: cleanPrice,
            images: urls,
            image_public_ids: publicIds,
            idempotency_key: key,
            session_id: sessionIdRef.current,
            delivery: deliveryForm
          })
        }),
        timeout(QUEUE_TIMEOUT)
      ]);

      if (!response.ok) {
        await cleanupPartialUploads();
        throw new Error("Queue failed");
      }

      setUi(prev => ({ ...prev, publishStatus: "processing" }));
      startPolling(key);

    } catch (err) {
      const isTimeout = err.message?.includes("Timeout");
      if (!isTimeout) await cleanupPartialUploads();

      setUi(prev => ({
        ...prev,
        loading: false,
        publishStatus: isTimeout ? "timeout" : "error"
      }));
    } finally {
      publishLockRef.current = false;
    }
  }, [
    ui.loading,
    uploadImages,
    getOrCreateIdempotency,
    getToken,
    form,
    cleanPrice,
    deliveryForm,
    cleanupPartialUploads,
    startPolling
  ]);

  /* ---------------- RENDER ---------------- */

  return (
    <div className="add-product-container">
      <ProductDetailsSection
        form={form}
        setForm={setForm}
        categoryFields={categoryFields}
        brands={brands}
        models={models}
        conditions={conditions}
        usedDetails={usedDetails}
        ramOptions={ramOptions}
        storageOptions={storageOptions}
        colors={colors}
        sims={sims}
        years={years}
        engines={engines}
        fuelTypes={fuelTypes}
        featuresByCategory={featuresByCategory}
        errors={ui.errors}
      />

      <PricingBoostSection
        form={form}
        setForm={setForm}
        promotionPlans={promotionPlans}
      />

      <DescriptionMediaSection
        form={form}
        setForm={setForm}
        images={images}
        setImages={setImages}
        fileInputRef={fileInputRef}
      />

      <DeliveryContactSection
        form={form}
        setForm={setForm}
        deliveryForm={deliveryForm}
        setDeliveryForm={setDeliveryForm}
        locationsByState={locationsByState}
      />

      <button
        onClick={handlePublish}
        disabled={ui.loading}
        className="publish-btn"
      >
        {ui.loading ? "Publishing..." : "Publish Product"}
      </button>
    </div>
  );
}