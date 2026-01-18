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
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);

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
  });

  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- LOAD DRAFT -------------------- */
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));

    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) {
      setForm(prev => ({ ...prev, mainCategory: savedCat }));
    }
  }, []);

  /* -------------------- SAVE DRAFT -------------------- */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) {
      localStorage.setItem(CATEGORY_KEY, form.mainCategory);
    }
  }, [form]);

  /* -------------------- SMART UPDATE (CORE FIX) -------------------- */
  const update = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };

      if (key === "mainCategory") {
        next.subCategory = "";
        next.brand = "";
        next.model = "";
        next.condition = "";
        next.usedDetail = "";
      }

      if (key === "subCategory") {
        next.brand = "";
        next.model = "";
      }

      if (key === "brand") {
        next.model = "";
      }

      if (key === "state") {
        next.city = "";
      }

      return next;
    });
  };

  /* -------------------- PRICE -------------------- */
  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      update("price", raw ? Number(raw).toLocaleString() : "");
    }
  };

  /* -------------------- IMAGES -------------------- */
  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      alert(`Maximum ${rules.maxImages} images allowed`);
      return;
    }
    update("images", [...form.images, ...list]);
    update(
      "previews",
      [...form.previews, ...list.map(f => URL.createObjectURL(f))]
    );
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  /* -------------------- VALIDATION -------------------- */
  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10)
      return "Enter valid phone number";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (
      (form.subCategory === "Smartphones" ||
        form.subCategory === "FeaturePhones") &&
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

  /* -------------------- SUBMIT -------------------- */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);
    if (!auth.currentUser) return alert("Login required");

    try {
      setLoading(true);
      const uploaded = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(form.price.replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);
      alert("Product posted successfully");
      navigate(`/${marketType}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- FULL PAGE LIST -------------------- */
  const FullPageList = ({ title, options, valueKey, allowCustom = true }) => {
    const [customValue, setCustomValue] = useState("");

    const submitCustom = () => {
      if (!customValue.trim()) return;
      update(valueKey, customValue.trim());
      setCustomValue("");
      setSelectionStep(null);
    };

    return (
      <div className="fullpage-list">
        {backStep && (
          <div
            className="options-back"
            onClick={() => setSelectionStep(backStep)}
          >
            Back
          </div>
        )}
        <h3>{title}</h3>

        <div className="options-scroll">
          {options.map(opt => (
            <div
              key={opt}
              className="option-item"
              onClick={() => {
                update(valueKey, opt);
                setSelectionStep(null);
              }}
            >
              {opt}
            </div>
          ))}

          {allowCustom && (
            <div className="option-item">
              <input
                placeholder={`Enter ${valueKey}`}
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitCustom()}
              />
              <button onClick={submitCustom}>Add</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* -------------------- OPTIONS -------------------- */
  const getSubcategories = () =>
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];

  const getBrandOptions = () =>
    phoneModels[form.subCategory]
      ? Object.keys(phoneModels[form.subCategory])
      : [];

  const getModelOptions = () =>
    phoneModels[form.subCategory]?.[form.brand] || [];

  /* -------------------- FULL PAGE ROUTER -------------------- */
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory":
        return (
          <FullPageList
            title="Select Subcategory"
            options={getSubcategories()}
            valueKey="subCategory"
          />
        );
      case "brand":
        return (
          <FullPageList
            title="Select Brand"
            options={getBrandOptions()}
            valueKey="brand"
          />
        );
      case "model":
        return (
          <FullPageList
            title="Select Model"
            options={getModelOptions()}
            valueKey="model"
          />
        );
      case "state":
        return (
          <FullPageList
            title="Select State"
            options={Object.keys(locationsByState)}
            valueKey="state"
          />
        );
      case "city":
        return (
          <FullPageList
            title="Select City / LGA"
            options={locationsByState[form.state] || []}
            valueKey="city"
          />
        );
      case "condition":
        return (
          <FullPageList
            title="Select Condition"
            options={conditions.main}
            valueKey="condition"
          />
        );
      case "usedDetail":
        return (
          <FullPageList
            title="Used Detail"
            options={conditions.usedDetails}
            valueKey="usedDetail"
          />
        );
      default:
        return null;
    }
  }

  /* -------------------- MAIN FORM -------------------- */
  return (
    <div className="add-product-container">
      <button onClick={() => navigate(`/${marketType}`)}>Back</button>

      <Field label="Title">
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
        />
      </Field>

      <Field label="Category">
        {categories.map(c => (
          <button
            key={c.name}
            className={form.mainCategory === c.name ? "active" : ""}
            onClick={() => update("mainCategory", c.name)}
          >
            {c.name}
          </button>
        ))}
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <div onClick={() => setSelectionStep("subCategory")}>
            {form.subCategory || "Select"}
          </div>
        </Field>
      )}

      {form.subCategory && (
        <Field label="Brand">
          <div onClick={() => setSelectionStep("brand")}>
            {form.brand || "Select"}
          </div>
        </Field>
      )}

      {form.brand && (
        <Field label="Model">
          <div onClick={() => setSelectionStep("model")}>
            {form.model || "Select"}
          </div>
        </Field>
      )}

      <button disabled={loading} onClick={handleSubmit}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- FIELD -------------------- */
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);