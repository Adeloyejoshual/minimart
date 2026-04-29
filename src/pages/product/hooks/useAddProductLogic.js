// src/products/hooks/useAddProductLogic.js
import { useMemo, useCallback, useEffect } from "react";
import { locationsByState } from "../../config/locationsByState.js";
import { promotionPlans } from "../../config/promotions.js";
import { categoryFields } from "../../config/categoryFields.js";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
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
    size: "",
    age_range: "",
    bedrooms: "",
    bathrooms: "",
    experience_level: "",
    skills: "",
  },
  delivery: {
    available: false,
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    whatsapp_link: "",
    email: "",
    preferred: "chat",
  },
};

const MAX_IMAGES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

export function useAddProductLogic() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categories, setCategories] = useState([]);

  const normalizeOptions = useCallback((list) => {
    if (!list) return [];
    return Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];
  }, []);

  const onlyNumbers = useCallback((v = "") => v.replace(/[^0-9.]/g, ""), []);
  const onlyDigits = useCallback((v = "") => v.replace(/[^0-9]/g, ""), []);

  const displayPrice = useCallback(
    (v) => {
      const num = Number(v);
      return Number.isNaN(num) || num <= 0
        ? ""
        : new Intl.NumberFormat("en-NG").format(num);
    },
    []
  );

  const formatLabel = useCallback((t) =>
    t
      .replace(/_/g, " ")
      .replace(/\bw/g, (l) => l.toUpperCase())
  );

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setCategories(data))
      .catch(() => {
        setCategories([]);
        showError("Failed to load categories");
      });
  }, [showError]);

  useEffect(() => {
    const savedPayment = localStorage.getItem(STORAGE_PAYMENT);
    if (savedPayment) localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_DRAFT);
    if (!saved) return;

    try {
      const draft = JSON.parse(saved);
      setForm({
        title: draft.form?.title ?? "",
        description: draft.form?.description ?? "",
        price: draft.form?.price ?? "",
        category_id: draft.form?.category_id ?? "",
        subcategory_id: draft.form?.subcategory_id ?? "",
        attributes: {
          ...INITIAL_FORM.attributes,
          ...(draft.form?.attributes || {}),
        },
        delivery: {
          available: draft.form?.delivery?.available ?? false,
          duration: {
            from: draft.form?.delivery?.duration?.from ?? "",
            to: draft.form?.delivery?.duration?.to ?? "",
          },
          fee: draft.form?.delivery?.fee ?? "",
          note: draft.form?.delivery?.note ?? "",
        },
        contact: {
          phone: draft.form?.contact?.phone ?? "",
          whatsapp: draft.form?.contact?.whatsapp ?? "",
          whatsapp_link: draft.form?.contact?.whatsapp_link ?? "",
          email: draft.form?.contact?.email ?? "",
          preferred: draft.form?.contact?.preferred ?? "chat",
        },
      });

      setState(draft.state || "");
      setCity(draft.city || "");
      setSelectedPlan(
        promotionPlans.find((p) => p.id === draft.selectedPlan) ||
          null
      );
      showSuccess("Draft restored");
    } catch {
      showError("Draft restore failed");
    }
  }, [showSuccess, showError]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            form,
            state,
            city,
            imagesCount: images.length,
            selectedPlan: selectedPlan?.id || null,
          })
        );
      } catch {}
    }, 1000);

    return () => clearTimeout(timeout);
  }, [form, state, city, images.length, selectedPlan?.id]);

  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback(
    (key, value) => {
      setForm((prev) => {
        const updated = { ...prev.attributes, [key]: value };
        if (key === "brand") updated.model = "";
        if (key === "condition") updated.used_detail = "";
        return { ...prev, attributes: updated };
      });
    },
    []
  );

  const updateContact = useCallback(
    (key, value) => {
      setForm((prev) => ({
        ...prev,
        contact: { ...prev.contact, [key]: value },
      }));
    },
    []
  );

  const updateDelivery = useCallback(
    (key, value) => {
      setForm((prev) => ({
        ...prev,
        delivery: { ...prev.delivery, [key]: value },
      }));
    },
    []
  );

  const updateDeliveryDuration = useCallback(
    (key, value) => {
      setForm((prev) => ({
        ...prev,
        delivery: {
          ...prev.delivery,
          duration: {
            ...prev.delivery.duration,
            [key]: value,
          },
        },
      }));
    },
    []
  );

  const toggleFeature = useCallback(
    (feature) => {
      setForm((prev) => {
        const features = prev.attributes?.features || [];
        const exists = features.includes(feature);
        return {
          ...prev,
          attributes: {
            ...prev.attributes,
            features: exists
              ? features.filter((f) => f !== feature)
              : [...features, feature],
          },
        };
      });
    },
    []
  );

  const compressImage = useCallback(async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch {
      return file;
    }
  }, []);

  const handleImages = useCallback(
    async (files) => {
      const currentCount = images.length;
      if (currentCount >= MAX_IMAGES)
        return showError("Maximum 6 images allowed");

      const fileArray = Array.from(files || []);
      const remaining = MAX_IMAGES - currentCount;
      const validFiles = fileArray
        .filter(
          (f) =>
            f.type.startsWith("image/") && f.size <= MAX_SIZE
        )
        .slice(0, remaining);

      const compressed = await Promise.all(
        validFiles.map((file) => compressImage(file))
      );
      const newImages = compressed.map((file) => ({
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setImages((prev) => [...prev, ...newImages]);
      showSuccess(`${compressed.length} image(s) added`);
    },
    [images.length, compressImage, showError, showSuccess]
  );

  const removeImage = useCallback(
    (id) => {
      setImages((prev) => {
        const target = prev.find((x) => x.id === id);
        if (target?.preview)
          URL.revokeObjectURL(target.preview);
        return prev.filter((x) => x.id !== id);
      });
    },
    []
  );

  const createProduct = useCallback(async () => {
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("price", Number(form.price).toString());
    fd.append(
      "category_id",
      form.category_id
    );
    fd.append(
      "subcategory_id",
      form.subcategory_id || ""
    );
    fd.append(
      "attributes",
      JSON.stringify(attributes)
    );
    fd.append(
      "delivery",
      JSON.stringify(form.delivery)
    );
    fd.append(
      "contact",
      JSON.stringify(form.contact)
    );
    fd.append("location_state", state);
    fd.append("location_city", city);

    const compressedFiles = await Promise.all(
      images.map((img) => compressImage(img.file))
    );
    compressedFiles.forEach((file) =>
      fd.append("images", file)
    );

    const token = localStorage.getItem("token");
    if (!token)
      throw new Error(
        "No authentication token; please log in again"
      );

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/marketplace/products",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      }
    );

    const text = await res.text();
    if (!res.ok)
      throw new Error(text || `HTTP ${res.status}`);

    return JSON.parse(text).product;
  }, [
    form,
    state,
    city,
    images,
    attributes,
    compressImage,
  ]);

  const initPayment = useCallback(async (productId) => {
    const token = localStorage.getItem("token");
    if (!token)
      throw new Error(
        "No token; please log in before paying"
      );

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initiate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(form.price),
          plan_id: selectedPlan.id,
          product_id: productId,
        }),
      }
    );

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success || !data.authorization_url) {
      throw new Error(
        data.message || "Payment initialization failed"
      );
    }

    return { reference: data.reference, authUrl: data.authorization_url };
  }, [
    form.contact.email,
    form.price,
    selectedPlan,
  ]);

  const activateFreePlan = useCallback(async (productId) => {
    const token = localStorage.getItem("token");
    if (!token)
      throw new Error(
        "No token; please log in before activating"
      );

    const res = await fetch(
      `https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promotion_id: selectedPlan?.id || null }),
      }
    );

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Product activation failed");
    }

    return data;
  }, [selectedPlan]);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Draft cleared");
  }, [showSuccess]);

  const validateForm = useCallback(() => {
    if (!form.title?.trim() || form.title.length < 10)
      return "Title must be at least 10 characters";
    if (!form.description?.trim() || form.description.length < 20)
      return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0)
      return "Valid price required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Valid phone required";
    if (!form.contact?.email?.includes("@"))
      return "Valid email required";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
      return "WhatsApp required";
    if (images.length === 0)
      return "Upload at least 1 image";
    if (!state || !city) return "Select state and city";

    if (form.delivery?.available) {
      const from = Number(form.delivery.duration?.from);
      const to = Number(form.delivery.duration?.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        return "Enter valid delivery duration";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter valid delivery fee";
    }

    return null;
  }, [form, images.length, state, city]);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const validationError = validateForm();
    if (validationError) return showError(validationError);

    setLoading(true);
    setError("");

    let product = null;

    try {
      const finalPlan =
        selectedPlan ||
        promotionPlans.find((p) => Number(p.price) === 0);
      if (!finalPlan)
        throw new Error("No promotion plan available");

      product = await createProduct();
      if (!product?.id)
        throw new Error("Failed to create product");

      if (Number(finalPlan.price) === 0) {
        await activateFreePlan(product.id);
        clearDraft();
        showSuccess("Product created and published!");
        return;
      }

            const paymentRes = await initPayment(product.id);
      const paymentSession = {
        reference: paymentRes.reference,
        authUrl: paymentRes.authUrl,
        planId: finalPlan.id,
        productId: product.id,
        email: form.contact.email,
        amount: Number(finalPlan.price),
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentSession));
      setPaymentData(paymentSession);
      showSuccess("Redirecting to payment...");
      window.open(paymentRes.authUrl, "_blank");
    } catch (err) {
      if (product?.id) {
        try {
          const token = localStorage.getItem("token");
          await fetch(
            `https://minimart-ivrm.onrender.com/api/marketplace/products/${product.id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );
        } catch {}
      }
      showError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    validateForm,
    selectedPlan,
    form,
    images,
    attributes,
    state,
    city,
    createProduct,
    activateFreePlan,
    initPayment,
    clearDraft,
    showError,
    showSuccess,
  ]);