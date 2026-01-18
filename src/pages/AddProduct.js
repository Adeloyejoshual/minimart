import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import phoneModels from "../config/phoneModels";
import conditions from "../config/condition";
import { promotionPlans } from "../config/promotionPlans";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({
    title: "",
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    priceRaw: "",
    price: "",
    phone: "",
    description: "",
    state: "",
    city: "",
    images: [],
    previews: [],
    promotionPlan: promotionPlans[0].id,
  });

  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- Draft Load -------------------- */
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      setForm(JSON.parse(saved));
      return;
    }
    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) {
      setForm(prev => ({ ...prev, mainCategory: savedCat }));
    }
  }, []);

  /* -------------------- Draft Save -------------------- */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) {
      localStorage.setItem(CATEGORY_KEY, form.mainCategory);
    }
  }, [form]);

  /* -------------------- Cleanup previews -------------------- */
  useEffect(() => {
    return () => form.previews.forEach(url => URL.revokeObjectURL(url));
  }, [form.previews]);

  /* -------------------- Helpers -------------------- */
  const update = (key, value, resetDeps = []) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      resetDeps.forEach(dep => (updated[dep] = ""));
      return updated;
    });
  };

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      setForm(prev => ({
        ...prev,
        priceRaw: raw,
        price: raw ? Number(raw).toLocaleString() : "",
      }));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      alert(`Maximum ${rules.maxImages} images allowed`);
      return;
    }
    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...list],
      previews: [
        ...prev.previews,
        ...list.map(f => URL.createObjectURL(f)),
      ],
    }));
  };

  const removeImage = index => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.priceRaw) return "Enter price";
    if (!form.phone || form.phone.length < 10)
      return "Enter valid phone number";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (
      (form.mainCategory === "Smartphones" ||
        form.mainCategory === "FeaturePhones") &&
      form.model &&
      !form.condition
    )
      return "Select condition";
    if (form.condition === "Used" && !form.usedDetail)
      return "Select used detail";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
  };

  /* -------------------- Submit -------------------- */
  const handleSubmit = async () => {
    if (loading) return;

    const error = validate();
    if (error) return alert(error);
    if (!auth.currentUser) return alert("Login required");

    try {
      setLoading(true);

      const uploads = await Promise.allSettled(
        form.images.map(img => uploadToCloudinary(img))
      );

      const images = uploads
        .filter(r => r.status === "fulfilled")
        .map(r => r.value);

      if (!images.length) {
        alert("Image upload failed");
        return;
      }

      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(form.priceRaw),
        images,
        coverImage: images[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      navigate(`/${marketType}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Derived Options -------------------- */
  const getSubcategories = () =>
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];

  const getBrandOptions = () =>
    phoneModels?.[form.mainCategory]
      ? Object.keys(phoneModels[form.mainCategory])
      : [];

  const getModelOptions = () =>
    form.brand
      ? phoneModels?.[form.mainCategory]?.[form.brand] || []
      : [];

  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () =>
    form.state ? locationsByState[form.state] : [];

  /* -------------------- Full Page Selection -------------------- */
  if (selectionStep) {
    const steps = {
      subCategory: getSubcategories(),
      brand: getBrandOptions(),
      model: getModelOptions(),
      state: getStateOptions(),
      city: getCityOptions(),
      condition: conditions.main,
      usedDetail: conditions.usedDetails,
    };

    return (
      <FullPageList
        title={`Select ${selectionStep}`}
        options={steps[selectionStep]}
        valueKey={selectionStep}
        form={form}
        update={update}
        setSelectionStep={setSelectionStep}
        backStep={backStep}
        setBackStep={setBackStep}
      />
    );
  }

  /* -------------------- Main Render -------------------- */
  return (
    <div className="add-product-container">
      {showSuccess && (
        <div className="success-toast">
          <img src="/marketplace.png" alt="" />
          <span>Product posted successfully!</span>
        </div>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- FullPageList -------------------- */
function FullPageList({
  title,
  options,
  valueKey,
  form,
  update,
  setSelectionStep,
  backStep,
}) {
  return (
    <div className="fullpage-list">
      {backStep && (
        <button onClick={() => setSelectionStep(backStep)}>← Back</button>
      )}
      <h3>{title}</h3>
      {options.map(opt => (
        <button
          key={opt}
          className={form[valueKey] === opt ? "active" : ""}
          onClick={() => {
            update(valueKey, opt);
            setSelectionStep(null);
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}