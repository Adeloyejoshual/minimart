import { useCallback, useEffect, useState } from "react";
import imageCompression from "browser-image-compression";

const STORAGE_PAYMENT = "payment_retry";

export default function SubmitSection({ 
  error, 
  success, 
  loading, 
  paymentData,
  handlers 
}) {
  const {
    form,
    images,
    state,
    city,
    selectedPlan,
    validateForm,
    clearDraft,
    createProduct,
    initPayment,
    activateFreePlan,
    showError,
    showSuccess,
    setLoading
  } = handlers;

  const [localLoading, setLocalLoading] = useState(false);

  // Validation function
  const validateFormLocal = useCallback(() => {
    if (!form.title?.trim() || form.title.length < 10) return "Title must be at least 10 characters";
    if (!form.description?.trim() || form.description.length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact?.phone || form.contact.phone.length < 10) return "Valid phone required";
    if (!form.contact?.email?.includes("@")) return "Valid email required";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10) return "WhatsApp required";
    if (images.length === 0) return "Upload at least 1 image";
    if (!state || !city) return "Select state and city";

    if (form.delivery?.available) {
      const from = Number(form.delivery.duration?.from);
      const to = Number(form.delivery.duration?.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Enter valid delivery duration";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Enter valid delivery fee";
    }

    return null;
  }, [form, images.length, state, city]);

  // Image compression utility
  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch {
      return file;
    }
  };

  // Create product API
  const createProductLocal = useCallback(async () => {
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("price", Number(form.price).toString());
    fd.append("category_id", form.category_id);
    fd.append("subcategory_id", form.subcategory_id || "");
    fd.append("attributes", JSON.stringify(form.attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));
    fd.append("location_state", state);
    fd.append("location_city", city);

    const compressedFiles = await Promise.all(images.map((img) => compressImage(img.file)));
    compressedFiles.forEach((file) => fd.append("images", file));

    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token; please log in again");

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fd,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

    return JSON.parse(text).product;
  }, [form, images, state, city]);

  // Initialize payment API
  const initPaymentLocal = useCallback(async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token; please log in before paying");

    const res = await fetch("https://minimart-ivrm.onrender.com/api/payment/initiate", {
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
    });

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success || !data.authorization_url) {
      throw new Error(data.message || "Payment initialization failed");
    }

    return { reference: data.reference, authUrl: data.authorization_url };
  }, [form.contact.email, form.price, selectedPlan?.id]);

  // Activate free plan API
  const activateFreePlanLocal = useCallback(async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token; please log in before activating");

    const res = await fetch(`https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ promotion_id: selectedPlan?.id || null }),
    });

    const text = await res.text();
    const data = JSON.parse(text);

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Product activation failed");
    }

    return data;
  }, [selectedPlan?.id]);

  // Main submit handler
  const handleSubmit = useCallback(async () => {
    if (localLoading || loading) return;

    const validationError = validateFormLocal();
    if (validationError) return showError(validationError);

    setLocalLoading(true);
    setLoading?.(true);
    showError("");

    let product = null;

    try {
      const finalPlan = selectedPlan || promotionPlans.find((p) => Number(p.price) === 0);
      if (!finalPlan) throw new Error("No promotion plan available");

      product = await createProductLocal();
      if (!product?.id) throw new Error("Failed to create product");

      if (Number(finalPlan.price) === 0) {
        await activateFreePlanLocal(product.id);
        clearDraft();
        showSuccess("Product created and published!");
        return;
      }

      const paymentRes = await initPaymentLocal(product.id);
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
      showSuccess("Redirecting to payment...");
      window.open(paymentRes.authUrl, "_blank");
    } catch (err) {
      if (product?.id) {
        try {
          const token = localStorage.getItem("token");
          await fetch(`https://minimart-ivrm.onrender.com/api/marketplace/products/${product.id}`, {
            method: "DELETE",
            headers: {
              Authorization: token ? `Bearer ${token}` : "",
            },
          });
        } catch {}
      }
      showError(err.message || "Something went wrong");
    } finally {
      setLocalLoading(false);
      setLoading?.(false);
    }
  }, [
    localLoading,
    loading,
    validateFormLocal,
    selectedPlan,
    createProductLocal,
    initPaymentLocal,
    activateFreePlanLocal,
    form.contact.email,
    form.price,
    clearDraft,
    showError,
    showSuccess,
    setLoading
  ]);

  // Handle payment retry from localStorage
  useEffect(() => {
    const savedPayment = localStorage.getItem(STORAGE_PAYMENT);
    if (savedPayment) {
      try {
        const paymentSession = JSON.parse(savedPayment);
        // You might want to validate if payment is still valid
        // For now, just set it for the Pay Now button
      } catch {
        localStorage.removeItem(STORAGE_PAYMENT);
      }
    }
  }, []);

  const handlePayNow = () => {
    if (paymentData?.authUrl) {
      window.open(paymentData.authUrl, "_blank");
    }
  };

  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  };

  return (
    <>
      <div className="button-section section form-card">
        <button 
          className="primary-btn" 
          type="button" 
          onClick={handleSubmit} 
          disabled={localLoading || loading}
        >
          {localLoading || loading ? "Processing..." : "🚀 Create Product"}
        </button>

        {paymentData && (
          <button 
            className="secondary-btn" 
            type="button" 
            onClick={handlePayNow}
          >
            💳 Pay Now
          </button>
        )}
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}
    </>
  );
}