// src/pages/Marketplace/AddProduct.jsx - ✅ FIXED CATEGORY + PAYSTACK
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { loadScript } from '@paypal/react-paypal-js'; // Fallback
import './AddProduct.css';

// ✅ ALL YOUR 13 CONFIGS - SAFE ACCESS
import { categoryFields } from '../../config/categoryFields';
import { brands } from '../../config/brands';
import { colors } from '../../config/colors';
import { conditions, usedDetails } from '../../config/conditions';
import { engines } from '../../config/engines';
import { featuresByCategory } from '../../config/featuresByCategory';
import { fieldOptions } from '../../config/fieldOptions';
import { fuelTypes } from '../../config/fuelTypes';
import { locationsByState } from '../../config/locationsByState';
import { models } from '../../config/models';
import { ramOptions } from '../../config/ramOptions';
import { sims } from '../../config/sim';
import { storageOptions } from '../../config/storageOptions';
import { years } from '../../config/years';
import { promotionPlans } from '../../config/promotion';

const AddProduct = () => {
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);
  const [paystackLoading, setPaystackLoading] = useState(false);
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);
  const { user, isAuthenticated } = useAuth0();

  // ✅ FIXED: Safe config access with fallback arrays
  const safeCategoryFields = categoryFields || {};
  const safeBrands = brands || {};
  const safeModels = models || {};
  const safeFeatures = featuresByCategory || {};
  const safeLocations = locationsByState || {};

  const categoriesList = Object.keys(safeCategoryFields).length > 0 ? Object.keys(safeCategoryFields) : ['Phones & Tablets', 'Vehicles', 'Electronics'];
  const dynamicFields = safeCategoryFields[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];
  const categoryBrands = safeBrands[category] || [];
  const categoryModels = safeModels[category] || [];
  const categoryFeatures = safeFeatures[category] || [];
  const stateCities = safeLocations[state] || [];

  // Reset features on category change
  useEffect(() => {
    if (category) {
      setSelectedFeatures([]);
      console.log('✅ Category loaded:', category, 'Fields:', dynamicFields.length);
    }
  }, [category]);

  const getFieldOptions = (fieldName) => {
    const options = {
      brand: categoryBrands,
      model: categoryModels,
      condition: conditions || [],
      used_detail: usedDetails || [],
      color: colors || [],
      ram: ramOptions || [],
      storage: storageOptions || [],
      sim: sims || [],
      engine: engines || [],
      fuel_type: fuelTypes || [],
      transmission: ['Manual', 'Automatic', 'Semi-Automatic'],
      year: years || []
    };
    return options[fieldName] || [];
  };

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(value || 0);
  };

  // ✅ PAYSTACK HANDLER
  const handlePaystackPayment = async () => {
    if (!selectedPlan || selectedPlan.price === 0) {
      setSelectedPlan(promotionPlans.find(p => p.id === 3)); // Free trial
      return;
    }

    setPaystackLoading(true);
    setMessage('🔄 Initializing Paystack...');

    try {
      // Create Paystack payment
      const response = await fetch('/api/marketplace/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPlan.price * 100, // kobo
          planId: selectedPlan.id,
          email: user?.email,
          productTitle: fieldRefs.current.title?.value || 'Product Promotion'
        })
      });

      const { data } = await response.json();
      
      const paystackHandler = window.PaystackPop.setup({
        key: 'pk_test_your_public_key_here', // Replace with your Paystack public key
        email: user?.email,
        amount: selectedPlan.price * 100,
        currency: 'NGN',
        ref: data.reference,
        callback: async (response) => {
          // Verify payment
          const verifyResponse = await fetch('/api/marketplace/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: response.reference })
          });

          if (verifyResponse.ok) {
            setMessage(`✅ ${selectedPlan.name} activated!`);
          } else {
            setMessage('❌ Payment verification failed');
          }
          setPaystackLoading(false);
          setShowPaystack(false);
        },
        onClose: () => {
          setPaystackLoading(false);
          setMessage('Payment cancelled');
        }
      });

      paystackHandler.openIframe();
    } catch (error) {
      setMessage('❌ Payment setup failed');
      setPaystackLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions');
      return;
    }

    const productData = {
      title: fieldRefs.current.title?.value?.trim() || '',
      category,
      price: parseInt(fieldRefs.current.price?.value?.replace(/,/g, '')) || 0,
      phone_number: fieldRefs.current.phone?.value?.trim() || '',
      state,
      city: fieldRefs.current.city?.value || '',
      description: fieldRefs.current.description?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.value || 'no',
      poster_name: user?.name || 'Anonymous Seller',
      country: "Nigeria",
      features: selectedFeatures,
      promotion_plan: selectedPlan ? selectedPlan.id : null,
      status: selectedPlan && selectedPlan.price > 0 ? 'promoted' : 'active'
    };

    dynamicFields.forEach(field => {
      const value = fieldRefs.current[field]?.value;
      if (value) productData[field] = value;
    });

    if (!productData.title || productData.price <= 0 || !productData.phone_number) {
      setMessage('❌ Title, price, and phone required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      const formData = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      imagesPreview.forEach(img => formData.append('images', img.file));

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => fieldRefs.current[key] && (fieldRefs.current[key].value = ''));
        setCategory(''); setState(''); setImagesPreview([]); setSelectedFeatures([]);
        setSelectedPlan(null); setTermsAccepted(false);
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Publish failed');
      }
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}</label>
        {options.length > 0 ? (
          <select ref={el => fieldRefs.current[fieldName] = el} className="field-select">
            <option value="">{`Select ${fieldName}`}</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
            className="field-input"
          />
        )}
      </div>
    );
  };

  if (!isAuthenticated) {
    return <div className="login-required">🔐 Please login to add products</div>;
  }

  return (
    <div className="add-product-container">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="product-form">
        {/* PRODUCT DETAILS */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input ref={el => fieldRefs.current.title = el} type="text" placeholder="Tecno Camon 19" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-large required" 
                required
              >
                <option value="">Select Category</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Brand</label>
              <select ref={el => fieldRefs.current.brand = el} className="input-large">
                <option value="">Select Brand</option>
                {categoryBrands.slice(0, 20).map(brand => ( // Limit to prevent lag
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Model</label>
              <select ref={el => fieldRefs.current.model = el} className="input-large">
                <option value="">Select Model</option>
                {categoryModels.slice(0, 20).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* PRICING & PROMOTION */}
        <section className="form-section">
          <h2>💰 Pricing & Promotion</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input 
                ref={el => fieldRefs.current.price = el}
                type="text"
                placeholder="150,000"
                className="input-large price-input required"
                onInput={(e) => {
                  let value = e.target.value.replace(/,/g, '');
                  e.target.value = formatPrice(value);
                }}
                required
              />
            </div>
            <div className="input-group">
              <label>Promotion Plan</label>
              <select 
                value={selectedPlan?.id || ''} 
                onChange={(e) => {
                  const planId = parseInt(e.target.value);
                  const plan = promotionPlans.find(p => p.id === planId);
                  setSelectedPlan(plan);
                  if (plan?.price === 0) {
                    setMessage('✅ Free trial activated!');
                  }
                }}
                className="input-large"
              >
                <option value="">No Promotion (Free Listing)</option>
                {promotionPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - ₦{formatPrice(plan.price)} ({plan.duration})
                    {plan.discount > 0 && ` Save ₦${formatPrice(plan.discount)}`}
                  </option>
                ))}
              </select>
              {selectedPlan && selectedPlan.price > 0 && (
                <button 
                  type="button"
                  onClick={() => setShowPaystack(true)}
                  className="paystack-btn"
                  disabled={paystackLoading}
                >
                  💳 Pay ₦{formatPrice(selectedPlan.price)} Now
                </button>
              )}
            </div>
          </div>
        </section>

        {/* REST OF FORM - Specifications, Features, Description, Location, Images */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications ({dynamicFields.length} fields)</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(renderDynamicField)}
            </div>
          </section>
        )}

        {/* FEATURES, DESCRIPTION, LOCATION, IMAGES - SAME AS BEFORE */}
        {categoryFeatures.length > 0 && (
          <section className="form-section">
            <h2>✨ Features ({categoryFeatures.length} available)</h2>
            <div className="features-grid">
              {categoryFeatures.slice(0, 12).map(feature => (
                <label key={feature} className="feature-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
            {selectedFeatures.length > 0 && (
              <div className="selected-features">
                Selected: {selectedFeatures.join(', ')}
              </div>
            )}
          </section>
        )}

        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <label>Description</label>
            <textarea ref={el => fieldRefs.current.description = el} rows="5" className="textarea-large" />
          </div>
        </section>

        <section className="form-section">
          <h2>📍 Location & Contact</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Phone Number *</label>
              <input ref={el => fieldRefs.current.phone = el} type="tel" placeholder="08012345678" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">State *</label>
              <select onChange={(e) => setState(e.target.value)} className="input-large required" required>
                <option value="">Select State</option>
                {Object.keys(safeLocations).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>City</label>
              <select ref={el => fieldRefs.current.city = el} className="input-large">
                <option value="">Select City</option>
                {stateCities.slice(0, 20).map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>🖼️ Product Images (Max 8)</h2>
          <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImages} className="file-upload" />
          {imagesPreview.length > 0 && (
            <div className="images-grid">
              {imagesPreview.map((img, index) => (
                <div key={index} className="image-preview">
                  <img src={img.preview} alt={`Preview ${index}`} />
                  <button type="button" onClick={() => removeImage(index)} className="remove-image">×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* TERMS & PUBLISH */}
        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>I agree to <strong>Terms & Conditions</strong> and marketplace policies</span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="submit-button"
            >
              {loading ? '📤 Publishing...' : `🚀 Publish Product${selectedPlan ? ` + ${selectedPlan.name}` : ''}`}
            </button>
          </div>
        </section>
      </form>

      {/* PAYSTACK MODAL */}
      {showPaystack && (
        <div className="paystack-modal">
          <div className="paystack-content">
            <h3>💳 Complete Payment</h3>
            <p><strong>{selectedPlan.name}</strong></p>
            <p>₦{formatPrice(selectedPlan.price)} - {selectedPlan.duration}</p>
            <button onClick={handlePaystackPayment} disabled={paystackLoading} className="paystack-confirm">
              {paystackLoading ? 'Processing...' : 'Pay with Paystack'}
            </button>
            <button onClick={() => setShowPaystack(false)} className="paystack-cancel">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProduct;