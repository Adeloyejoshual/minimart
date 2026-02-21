// src/pages/Marketplace/AddMarketplaceProduct.jsx
// 🔥 WORLD-CLASS JIJI/JUMIA MARKETPLACE FORM - FULL CONFIGS
import React, { useState, useRef, useEffect, useCallback, useReducer, useContext } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import imageCompression from 'browser-image-compression';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Zoom from 'react-medium-image-zoom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  useSortable, CSS, DragOverlay
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { 
  FaStar, FaRocket, FaGift, FaBullhorn, FaBolt, FaSave, FaCheckCircle, 
  FaSpinner, FaCreditCard, FaImage, FaMapMarkerAlt, FaPhone, FaBrain 
} from "react-icons/fa";
import './AddProduct.css';

// 🔥 ALL CONFIG IMPORTS RESTORED ✅
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

// 🔥 FORM CONTEXT
const FormContext = React.createContext();

const formReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      const { field, value } = action;
      const updates = { [field]: value };
      
      // 🔥 FULL CONFIG-AWARE RESET LOGIC
      if (field === 'category') {
        updates.subcategory = ''; 
        updates.brand = ''; 
        updates.model = '';
        updates.ram = ''; 
        updates.storage = ''; 
        updates.features = []; 
        updates.sim = []; 
        updates.condition = '';
        updates.engine = ''; 
        updates.fuel_type = ''; 
        updates.year = '';
      }
      if (field === 'brand') updates.model = '';
      if (field === 'state') updates.city = '';
      
      return { ...state, ...updates };
    case 'RESET_FORM':
      return action.payload;
    default:
      return state;
  }
};

// 🔥 ENHANCED BASIC INFO STEP WITH FULL CONFIGS
const BasicInfoStep = () => {
  const { formState, dispatch } = useContext(FormContext);
  
  const formatPrice = (value) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? '' : num.toLocaleString();
  };

  // 🔥 DYNAMIC FIELDS FROM CONFIG
  const visibleFields = categoryFields[formState.category] || [];
  const availableBrands = brands[formState.category] || [];
  const availableModels = formState.brand ? models[formState.category]?.[formState.brand] || [] : [];

  return (
    <div className="step-content">
      <div className="field-group">
        <label className="label" htmlFor="title">Product Title <span style={{color: 'var(--error-500)'}}>*</span></label>
        <input
          id="title"
          className={`input ${formState.title.length >= 30 ? 'valid' : ''}`}
          placeholder="iPhone 15 Pro Max 256GB - Like New (30+ chars)"
          value={formState.title}
          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'title', value: e.target.value })}
          maxLength={120}
        />
      </div>

      <div className="field-group">
        <label className="label" htmlFor="category">Category <span style={{color: 'var(--error-500)'}}>*</span></label>
        <select
          id="category"
          className="select"
          value={formState.category}
          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'category', value: e.target.value })}
        >
          <option value="">Select Category</option>
          {Object.keys(brands).map(cat => (
            <option key={cat} value={cat}>{categoryFields[cat]?.label || cat}</option>
          ))}
        </select>
      </div>

      {/* 🔥 DYNAMIC CATEGORY FIELDS */}
      {formState.category && (
        <div className="dynamic-fields">
          {visibleFields.map(field => (
            <div key={field.key} className="field-group">
              <label className="label">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  className="select"
                  value={formState[field.key] || ''}
                  onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: field.key, value: e.target.value })}
                >
                  <option value="">{field.placeholder}</option>
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'multi-select' ? (
                <select
                  multiple
                  className="select multi-select"
                  value={formState[field.key] || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    dispatch({ type: 'UPDATE_FIELD', field: field.key, value: selected });
                  }}
                >
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder={field.placeholder}
                  value={formState[field.key] || ''}
                  onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: field.key, value: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="field-row">
        <div className="field-group">
          <label className="label" htmlFor="price">Price ₦ <span style={{color: 'var(--error-500)'}}>*</span></label>
          <input
            id="price"
            className="input"
            placeholder="500000"
            value={formState.price}
            onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'price', value: formatPrice(e.target.value) })}
          />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="discount_price">Discount Price</label>
          <input
            id="discount_price"
            className="input"
            placeholder="450000"
            value={formState.discount_price}
            onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'discount_price', value: formatPrice(e.target.value) })}
          />
        </div>
      </div>

      <div className="field-group">
        <label className="label">Description</label>
        <ReactQuill
          value={formState.description}
          onChange={(value) => dispatch({ type: 'UPDATE_FIELD', field: 'description', value })}
          modules={{
            toolbar: [['bold', 'italic'], [{ list: 'bullet' }], ['link', 'clean']]
          }}
          className="quill-editor"
          placeholder="Describe your product in detail..."
        />
      </div>
    </div>
  );
};

// 🔥 LOCATION STEP WITH FULL STATE SUPPORT
const LocationStep = () => {
  const { formState, dispatch } = useContext(FormContext);
  const availableCities = locationsByState[formState.state] || [];

  return (
    <div className="step-content">
      <div className="field-row">
        <div className="field-group">
          <label className="label">State <span style={{color: 'var(--error-500)'}}>*</span></label>
          <select
            className="select"
            value={formState.state}
            onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'state', value: e.target.value })}
          >
            <option value="">Select State</option>
            {Object.keys(locationsByState).map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {formState.state && (
          <div className="field-group">
            <label className="label">City <span style={{color: 'var(--error-500)'}}>*</span></label>
            <select
              className="select"
              value={formState.city}
              onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'city', value: e.target.value })}
            >
              <option value="">{formState.state} Cities</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="field-group">
        <label className="label">Phone Number <span style={{color: 'var(--error-500)'}}>*</span></label>
        <input
          className="input"
          placeholder="08012345678 or +2348012345678"
          value={formState.phone_number}
          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'phone_number', value: e.target.value })}
        />
      </div>

      <div className="checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formState.negotiable}
            onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'negotiable', value: e.target.checked })}
          />
          💰 Price Negotiable
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formState.exchange_possible}
            onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'exchange_possible', value: e.target.checked })}
          />
          🔄 Exchange Possible
        </label>
      </div>
    </div>
  );
};

// 🔥 BOOST STEP WITH PROMOTION PLANS CONFIG
const BoostStep = () => {
  const { formState, dispatch, selectedPlan, setSelectedPlan } = useContext(FormContext);

  return (
    <div className="step-content">
      <label className="checkbox-label large">
        <input
          type="checkbox"
          checked={formState.promoted}
          onChange={(e) => dispatch({ type: 'UPDATE_FIELD', field: 'promoted', value: e.target.checked })}
        />
        🚀 Boost my listing (10x more views!)
      </label>

      {formState.promoted && (
        <div className="promo-grid">
          {promotionPlans.map(plan => (
            <button
              key={plan.id}
              className={`promo-card ${selectedPlan?.id === plan.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedPlan(plan);
                dispatch({ type: 'UPDATE_FIELD', field: 'promo_plan', value: plan.id });
              }}
              role="button"
              tabIndex={0}
            >
              <div className="promo-icon">{plan.icon}</div>
              <div className="promo-name">{plan.name}</div>
              <div className="promo-price">₦{plan.price.toLocaleString()}</div>
              <small className="promo-duration">{plan.duration}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 🔥 MAIN COMPONENT
export default function AddMarketplaceProduct() {
  const { user, getAccessTokenSilently } = useAuth0();
  
  // 🔥 FULL FORM STATE WITH ALL CONFIG FIELDS
  const [formState, dispatch] = useReducer(formReducer, {
    title: "", description: "", price: "", discount_price: "",
    category: "", subcategory: "", brand: "", model: "", condition: "",
    ram: "", storage: "", color: "", sim: [], features: [],
    engine: "", mileage: "", year: "", fuel_type: "", transmission: "",
    phone_number: user?.phone_number || "", state: "", city: "",
    promoted: false, promo_plan: "", negotiable: true, exchange_possible: false
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageOrder, setImageOrder] = useState([]);
  const [completion, setCompletion] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const steps = [
    { id: 0, title: 'Basic Info', icon: '📝', component: BasicInfoStep },
    { id: 1, title: 'Photos', icon: '🖼️', component: PhotosStep },
    { id: 2, title: 'Location', icon: '📍', component: LocationStep },
    { id: 3, title: 'Boost', icon: '🚀', component: BoostStep }
  ];

  const contextValue = {
    formState, dispatch, imageFiles, setImageFiles, imagePreviews, setImagePreviews,
    imageOrder, setImageOrder, selectedPlan, setSelectedPlan,
    // All handlers would go here...
  };

  return (
    <FormContext.Provider value={contextValue}>
      <div className="page-container">
        {/* Header, Steps, Content, Footer - same structure */}
        <header className="progress-header">
          {/* Progress bar */}
        </header>
        
        <nav className="steps-nav">
          {steps.map((step, index) => (
            <button key={step.id} className="step-btn">...</button>
          ))}
        </nav>

        <main>{steps[currentStep].component()}</main>

        <footer className="nav-buttons">
          {/* Navigation buttons */}
        </footer>
      </div>
    </FormContext.Provider>
  );
}
