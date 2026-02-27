// src/pages/Marketplace/AddProduct.jsx - ✅ NO HEADERS + VITE + PUBLIC ROUTE
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ NO .env NEEDED - PUBLIC ROUTE
// ✅ ALL 13 CONFIGS (same as before)
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
  const { user, isAuthenticated } = useAuth0(); // ✅ Only for user.name

  // ✅ ALL STATE (same)
  const [formData, setFormData] = useState({
    title: '', brand: '', model: '', price: '', phone_number: '',
    description: '', negotiation: 'no', condition: '', color: '',
    ram: '', storage: '', sim: '', engine: '', fuel_type: '',
    transmission: '', year: '', mileage: '', used_detail: ''
  });
  
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(localStorage.getItem('termsAccepted') === 'true');

  // ✅ DATA (same nested models logic)
  const categoriesList = Object.keys(categoryFields || {});
  const categoryBrands = brands?.[category] || [];
  const categoryModels = models?.[category]?.[formData.brand] || [];
  const categoryFeatures = featuresByCategory?.[category] || [];
  const stateCities = locationsByState?.[state] || [];

  // ✅ EFFECTS (same)
  useEffect(() => { setFormData(prev => ({ ...prev, model: '' })); }, [formData.brand]);
  useEffect(() => {
    if (category) {
      setSelectedFeatures([]);
      setFormData(prev => ({
        ...prev, brand: '', model: '', condition: '', color: '',
        ram: '', storage: '', sim: '', engine: '', fuel_type: '',
        transmission: '', year: '', mileage: '', used_detail: ''
      }));
    }
  }, [category]);

  // ✅ HELPERS (same)
  const getFieldOptions = (fieldName) => {
    if (fieldName === 'model' && formData.brand && category) {
      return models?.[category]?.[formData.brand] || [];
    }
    const optionsMap = {
      brand: categoryBrands, condition: conditions || [], used_detail: usedDetails || [],
      color: colors || [], ram: ramOptions || [], storage: storageOptions || [],
      sim: sims || [], engine: engines || [], fuel_type: fuelTypes || [],
      transmission: fieldOptions?.transmission || ['Manual', 'Automatic'], year: years || []
    };
    return optionsMap[fieldName] || fieldOptions?.[fieldName] || [];
  };

  const dynamicFields = categoryFields?.[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];

  const formatPrice = (value) => new Intl.NumberFormat('en-NG').format(parseInt(value) || 0);
  const updateFormField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  // ✅ FIXED: NO HEADERS - Pure FormData
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions first');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      const productData = {
        ...formData,
        category, state, city, features: selectedFeatures,
        promotion_plan: selectedPlan ? selectedPlan.id : null,
        poster_name: user?.name || 'Anonymous Seller',
        country: "Nigeria",
        price: parseInt(formData.price.replace(/,/g, '')) || 0
      };

      if (!productData.title?.trim() || productData.price <= 0 || !productData.phone_number) {
        setMessage('❌ Title, price, and phone number required');
        return;
      }

      const formDataSubmit = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formDataSubmit.append(key, item));
        } else if (value !== null && value !== undefined && value !== '') {
          formDataSubmit.append(key, String(value));
        }
      });
      imagesPreview.forEach(img => formDataSubmit.append('images', img.file));

      // ✅ NO HEADERS = FormData auto-handles Content-Type + boundary
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formDataSubmit  // ✅ NO HEADERS - Backend expects this exactly!
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);
        
        // RESET FORM
        setFormData({
          title: '', brand: '', model: '', price: '', phone_number: '',
          description: '', negotiation: 'no', condition: '', color: '',
          ram: '', storage: '', sim: '', engine: '', fuel_type: '',
          transmission: '', year: '', mileage: '', used_detail: ''
        });
        setCategory(''); setState(''); setCity(''); 
        setImagesPreview([]); setSelectedFeatures([]); setSelectedPlan(null);
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ SAME JSX (condensed for response)
  if (!isAuthenticated) {
    return <div className="login-required">🔐 Please login to add products</div>;
  }

  return (
    <div className="add-product-container">
      {message && <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>{message}</div>}
      
      <form onSubmit={handleSubmit} className="product-form">
        {/* PRODUCT DETAILS - SAME AS BEFORE */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input value={formData.title} onChange={(e) => updateFormField('title', e.target.value)}
                type="text" placeholder="Tecno Camon 19 32GB Green" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <CustomDropdown options={categoriesList} value={category} onChange={setCategory}
                placeholder="Select Category" className="input-large required" />
            </div>
            <div className="input-group">
              <label>Brand</label>
              <CustomDropdown options={categoryBrands} value={formData.brand}
                onChange={(value) => updateFormField('brand', value)} placeholder="Select Brand"
                className="input-large" disabled={!category} />
            </div>
            <div className="input-group">
              <label>Model</label>
              <CustomDropdown options={categoryModels} value={formData.model}
                onChange={(value) => updateFormField('model', value)}
                placeholder={formData.brand ? `Select ${formData.brand} Model` : "Select Brand First"}
                className="input-large" disabled={!formData.brand || !category} />
            </div>
          </div>
        </section>

        {/* Pricing, Specs, Features, Images, Terms - SAME JSX */}
        {/* ... (keeping response concise) ... */}

        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => {
                setTermsAccepted(e.target.checked);
                localStorage.setItem('termsAccepted', e.target.checked);
              }} />
              <span>I agree to <a href="/terms" target="_blank" rel="noopener noreferrer" className="terms-link">Terms & Conditions</a></span>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loading || !termsAccepted} className="submit-button">
              {loading ? '📤 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;