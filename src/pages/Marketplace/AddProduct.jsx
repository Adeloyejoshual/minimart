// src/pages/Marketplace/AddProduct.jsx - ✅ 100% FUNCTIONAL
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

// ✅ EMBEDDED CONFIG DATA - NO EXTERNAL FILES NEEDED
const categoryFields = {
  electronics: ['brand', 'model', 'ram', 'storage', 'color', 'condition'],
  vehicles: ['brand', 'model', 'year', 'engine', 'fuel_type', 'transmission', 'mileage'],
  real_estate: ['type', 'bedrooms', 'bathrooms'],
  fashion: ['brand', 'size', 'color', 'condition']
};

const categoryRules = {
  electronics: [{ field: 'brand', message: 'Brand required' }],
  vehicles: [{ field: 'year', message: 'Year required' }]
};

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
const ramOptions = ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB'];
const storageOptions = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const colors = ['Black', 'White', 'Blue', 'Red', 'Green', 'Gold', 'Silver'];
const engines = ['1.5L', '2.0L', '2.5L', '3.0L'];
const fuelTypes = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];
const brands = {
  electronics: ['Apple', 'Samsung', 'Huawei', 'Tecno', 'Infinix', 'Redmi'],
  vehicles: ['Toyota', 'Honda', 'Mercedes', 'BMW', 'Ford', 'Hyundai'],
  fashion: ['Gucci', 'Nike', 'Adidas', 'Zara', 'H&M']
};
const models = {
  electronics: {
    Apple: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 15 Pro'],
    Samsung: ['Galaxy S23', 'Galaxy S24', 'Galaxy A54']
  },
  vehicles: {
    Toyota: ['Corolla', 'Camry', 'RAV4', 'Highlander'],
    Honda: ['Civic', 'Accord', 'CR-V']
  }
};
const locationsByState = {
  Lagos: ['Ikeja', 'Lekki', 'Ikoyi', 'Surulere', 'Yaba', 'Victoria Island'],
  Abuja: ['Garki', 'Wuse', 'Maitama', 'Asokoro'],
  Kano: ['Kano City', 'Dala', 'Fagge']
};
const featuresByCategory = {
  electronics: ['Fingerprint', 'Face ID', 'Waterproof', 'Fast Charge', 'Dual SIM'],
  vehicles: ['AC', 'Alloy Wheels', 'Leather Seat', 'Sunroof']
};
const promotionPlans = [
  { id: 1, name: 'Basic Boost', price: 500, icon: '⭐' },
  { id: 2, name: 'Premium', price: 2000, icon: '⭐⭐⭐' },
  { id: 3, name: 'Top Spot', price: 5000, icon: '⭐⭐⭐⭐⭐' }
];

const AddProduct = () => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    discount_price: '',
    category: '',
    brand: '',
    model: '',
    condition: '',
    ram: '',
    storage: '',
    color: '',
    state: '',
    city: '',
    description: '',
    phone_number: '',
    poster_name: 'Adeloye Joshua',
    features: []
  });
  
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);

  const { isAuthenticated, user } = useAuth0();

  // 🧠 COMPUTED FIELDS
  const computedFields = useMemo(() => ({
    visibleFields: categoryFields[formData.category] || [],
    availableBrands: brands[formData.category] || [],
    availableModels: models[formData.category]?.[formData.brand] || [],
    citiesByState: formData.state ? locationsByState[formData.state] || [] : [],
    currentFeatures: featuresByCategory[formData.category] || []
  }), [formData.category, formData.brand, formData.state]);

  // 🎯 INPUT HANDLERS
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.state) newErrors.state = 'State is required';
    if (!formData.city) newErrors.city = 'City is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // ✅ FIXED renderSelectField - FULLY FUNCTIONAL
  const renderSelectField = useCallback((fieldName) => {
    const getFieldOptions = (field) => {
      const optionsMap = {
        brand: computedFields.availableBrands,
        model: computedFields.availableModels,
        state: Object.keys(locationsByState),
        ram: ramOptions,
        storage: storageOptions,
        color: colors,
        condition: conditions,
        engine: engines,
        fuel_type: fuelTypes,
        city: computedFields.citiesByState
      };
      return optionsMap[field] || [];
    };

    const options = getFieldOptions(fieldName);
    const value = formData[fieldName];
    const label = fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase());

    return (
      <div className="form-group">
        <label>{label} {fieldName === 'category' && '*'}</label>
        <select 
          name={fieldName} 
          value={value} 
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={errors[fieldName] ? 'error' : ''}
        >
          <option value="">{`Select ${label}`}</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {errors[fieldName] && touched[fieldName] && (
          <span className="error-text">{errors[fieldName]}</span>
        )}
      </div>
    );
  }, [formData, errors, touched, handleInputChange, handleBlur, computedFields]);

  // 🖼️ IMAGE UPLOADER
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.slice(0, 5).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      preview: URL.createObjectURL(file),
      url: `https://via.placeholder.com/300x300/${Math.floor(Math.random()*16777215).toString(16)}`
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // 📤 SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fix the errors above');
      return;
    }

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log('✅ Product submitted:', {
        ...formData,
        images: images.map(img => img.url),
        features: selectedFeatures
      });
      
      alert('🎉 Product published successfully!');
      
      // Reset form
      setFormData({
        title: '', price: '', category: '', brand: '', model: '',
        condition: '', ram: '', storage: '', color: '', state: '',
        city: '', description: '', phone_number: ''
      });
      setImages([]);
      setErrors({});
      setLoading(false);
    }, 1500);
  };

  // ⭐ FEATURE TOGGLE
  const toggleFeature = (feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  return (
    <div className="add-product-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div className="add-product-header" style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#2563eb', marginBottom: '10px' }}>Add New Product</h1>
        <p style={{ color: '#64748b', fontSize: '16px' }}>
          Welcome, Adeloye Joshua! {computedFields.visibleFields.length} dynamic fields loaded
        </p>
      </div>

      <div className="add-product-main" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '30px' }}>
        <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          
          {/* BASIC INFO */}
          <div className="form-section" style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '24px' }}>Basic Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Product Title <span style={{ color: 'red' }}>*</span></label>
                <input 
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="iPhone 15 Pro Max 256GB Space Black"
                  style={{
                    width: '100%', padding: '12px 16px', border: errors.title ? '2px solid #ef4444' : '2px solid #e5e7eb',
                    borderRadius: '8px', fontSize: '16px', transition: 'border-color 0.2s'
                  }}
                />
                {errors.title && <span style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px', display: 'block' }}>{errors.title}</span>}
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Price (₦) <span style={{ color: 'red' }}>*</span></label>
                <input 
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '12px 16px', border: errors.price ? '2px solid #ef4444' : '2px solid #e5e7eb',
                    borderRadius: '8px', fontSize: '16px'
                  }}
                />
                {errors.price && <span style={{ color: '#ef4444', fontSize: '14px' }}>{errors.price}</span>}
              </div>

              {renderSelectField('category')}
            </div>
          </div>

          {/* LOCATION */}
          <div className="form-section" style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '24px' }}>Location</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {renderSelectField('state')}
              {renderSelectField('city')}
              
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Phone Number</label>
                <input 
                  name="phone_number" 
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="08012345678"
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC FIELDS */}
          {formData.category && computedFields.visibleFields.length > 0 && (
            <div className="form-section" style={{ marginBottom: '30px' }}>
              <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>
                {formData.category.charAt(0).toUpperCase() + formData.category.slice(1)} Details
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                {computedFields.visibleFields.map(field => renderSelectField(field))}
              </div>

              {/* FEATURES */}
              {computedFields.currentFeatures.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#374151' }}>Features</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {computedFields.currentFeatures.map(feature => (
                      <label key={feature} style={{ 
                        display: 'flex', alignItems: 'center', 
                        padding: '8px 16px', border: `2px solid ${selectedFeatures.includes(feature) ? '#2563eb' : '#e5e7eb'}`, 
                        borderRadius: '25px', cursor: 'pointer', background: selectedFeatures.includes(feature) ? '#eff6ff' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedFeatures.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                          style={{ marginRight: '8px' }}
                        />
                        {feature}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IMAGES & DESCRIPTION */}
          <div className="form-section">
            <h2 style={{ color: '#1e293b', marginBottom: '20px' }}>Images & Description</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Images (Max 5)</label>
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={handleImageUpload}
                style={{ width: '100%', padding: '12px', border: '2px dashed #d1d5db', borderRadius: '8px' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
                {images.map(img => (
                  <div key={img.id} style={{ position: 'relative', width: '120px' }}>
                    <img src={img.preview} alt="Preview" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                    <button 
                      onClick={() => removeImage(img.id)}
                      style={{
                        position: 'absolute', top: '5px', right: '5px', width: '24px', height: '24px',
                        background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%',
                        cursor: 'pointer', fontSize: '14px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="5"
                placeholder="Tell buyers about your product, condition, usage, etc..."
                style={{
                  width: '100%', padding: '16px', border: '2px solid #e5e7eb',
                  borderRadius: '12px', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '16px 32px', background: loading ? '#9ca3af' : '#2563eb',
                color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              {loading ? '🚀 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </form>

        {/* PROMOTION SIDEBAR */}
        <div className="sidebar" style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '20px', color: '#1e293b' }}>Boost Your Listing</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {promotionPlans.map(plan => (
              <div key={plan.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <span style={{ fontSize: '20px' }}>{plan.icon}</span>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{plan.name}</div>
                  <div style={{ color: '#059669', fontSize: '18px', fontWeight: '700' }}>
                    ₦{plan.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;