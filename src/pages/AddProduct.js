// src/pages/AddProduct.js
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "../firebase";
import Toast from "../components/Toast";
import AddProductForm from "../components/AddProduct/AddProductForm";
import FullPageList from "../components/AddProduct/FullPageList";
import FullPageMultiSelect from "../components/AddProduct/FullPageMultiSelect";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
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
    paymentSuccess: false,
  });

  // ---------------- Draft Load ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));
    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat }));
  }, []);

  // ---------------- Draft Save ----------------
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) localStorage.setItem(CATEGORY_KEY, form.mainCategory);
  }, [form]);

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Form Updater ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // ---------------- FullPage Selector Rendering ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory":
      case "brand":
      case "model":
      case "condition":
      case "usedDetail":
      case "colors":
      case "simTypes":
      case "types":
      case "state":
      case "city":
        return (
          <FullPageList
            title={selectionStep}
            options={form[selectionStep + "Options"] || []}
            valueKey={selectionStep}
            update={update}
            scrollPos={scrollPos}
            backStep={backStep}
            setSelectionStep={setSelectionStep}
          />
        );
      case "features":
        return (
          <FullPageMultiSelect
            title="Features"
            options={form.featuresOptions || []}
            valueKey="features"
            update={update}
            scrollPos={scrollPos}
            backStep={backStep}
            setSelectionStep={setSelectionStep}
          />
        );
      default:
        break;
    }
  }

  // ---------------- Main Page Render ----------------
  return (
    <div className="add-product-page">
      <AddProductForm
        form={form}
        update={update}
        showToast={showToast}
        scrollPos={scrollPos}
        setSelectionStep={setSelectionStep}
        setBackStep={setBackStep}
        marketType={marketType}
        navigate={navigate}
      />
      <Toast visible={toast.visible} message={toast.message} icon={toast.icon} />
    </div>
  );
}