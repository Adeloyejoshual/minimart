// src/pages/Marketplace/AddProduct.jsx - ✅ MATCHES YOUR EXACT DB STRUCTURE
import React, { useState, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AddProduct = () => {
  // ✅ STATE MATCHING YOUR DB FIELDS
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [exchangePossible, setExchangePossible] = useState(false);
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // ✅ YOUR EXACT CATEGORY SYSTEM
  const categories = [
    "Phones & Tablets", "Vehicles", "Babies & Kids", "Property", "Electronics",
    "Beauty & Personal Care", "Home, Furniture & Appliances", "Fashion",
    "Computers & Laptops", "Gaming", "Vehicles Parts & Accessories"
  ];

  // ✅ DYNAMIC FIELDS FROM YOUR DB
  const categoryFields = {
    "Phones & Tablets": ["brand", "model", "condition", "ram", "storage", "color", "sim"],
    "Vehicles": ["brand", "model", "condition", "engine", "mileage", "year", "fuel_type", "transmission"],
    "Computers & Laptops": ["brand", "model", "condition", "ram", "storage"],
    "Electronics": ["brand", "model", "condition"],
    "Fashion": ["brand", "size", "color"]
  };

  // ✅ YOUR REAL DATA OPTIONS
  const options = {
    brands: {
      "Phones & Tablets": ["Apple", "Samsung", "Tecno", "Infinix", "Redmi", "Huawei"],
      "Vehicles": ["Toyota", "Honda", "BMW", "Mercedes", "Nissan"],
      "Computers & Laptops": ["Apple", "Dell", "HP", "Lenovo"]
    },
    conditions: ["Brand New", "Used", "Refurbished"],
    ram: ["2GB", "4GB", "6GB", "8GB", "12GB", "16GB"],
    storage: ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
    sim: ["Single SIM", "Dual SIM", "eSIM"],
    fuel_type: ["Petrol", "Diesel", "Electric", "Hybrid"],
    transmission: ["Manual", "Automatic"]
  };

  const states = ["Lagos", "Abuja", "Kano", "Oyo", "Rivers"];
  const locations = {
    Lagos: ["Ikeja", "Lekki", "Ikoyi", "Yaba", "Surulere"],
    Abuja: ["Wuse", "Garki", "Maitama"]
  };

  const dynamicFields = category ? categoryFields[category] || [] : [];
  const categoryBrands = category ? options.brands[category] || [] : [];
  const stateCities = state ? locations[state] || [] : [];

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }
    
    files.forEach(file => {
      const shortName = file.name.length > 25 ? 
        `${file.name.substring(0, 22)}...${file.name.split('.').pop()}` : file.name;
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { 
        file, preview, name: shortName, originalName: file.name 
      }]);
    });
  }, [imagesPreview.length]);

  const removeImage = (index) => {
    URL.revokeObjectURL(imagesPreview[index].preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ MATCHES YOUR EXACT DB SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ EXACTLY YOUR DB STRUCTURE
    const productData = {
      title: fieldRefs.current.title?.value || '',
      category,
      brand: fieldRefs.current.brand?.value || '',
      model: fieldRefs.current.model?.value || '',
      condition: fieldRefs.current.condition?.value || '',
      ram: fieldRefs.current.ram?.value || '',
      storage: fieldRefs.current.storage?.value || '',
      color: fieldRefs.current.color?.value || '',
      sim: fieldRefs.current.sim?.value || '',
      description: fieldRefs.current.description?.value || '',
      price: parseInt(fieldRefs.current.price?.value) || 0,
      negotiation: fieldRefs.current.negotiation?.checked ? "Yes" : "No",
      phone_number: fieldRefs.current.phone?.value || '',
      poster_name: user?.name || 'Anonymous',
      country: "Nigeria",
      state,
      city: fieldRefs.current.city?.value || '',
      exchange_possible: exchangePossible,
      features: fieldRefs.current.features?.value || '',
      images: imagesPreview.map(img => img.originalName)
    };

    // Log exact data structure
    console.log('🚀 SUBMITTING TO YOUR DB:', productData);

    if (!productData.title.trim() || !productData.price || productData.price <= 0) {
      setMessage('❌ Title and valid price required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing to database...');

      // ✅ REAL API CALL - Replace with your endpoint
      const token = await getAccessTokenSilently();
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });

      if (response.ok) {
        setMessage('🎉 Product published successfully!');
        
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => {
          if (fieldRefs.current[key]) fieldRefs.current[key].value = '';
        });
        fieldRefs.current.negotiation.checked = false;
        setCategory(''); setState(''); setImagesPreview([]); setExchangePossible(false);
        
        setTimeout(() => setMessage(''), 4000);
      } else {
        throw new Error('Failed to publish');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setMessage('❌ Publish failed. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const renderDynamicField = (fieldName) => {
    const options = fieldName === 'brand' ? categoryBrands :
                   fieldName === 'condition' ? options.conditions :
                   options[fieldName] || [];

    const isCheckbox = fieldName === 'negotiation';
    const isSelect = options.length > 0 && !isCheckbox;

    return (
      <div key={fieldName} style={{ flex: 1, minWidth: '200px' }}>
        <label style={{ 
          display: 'block', 
          fontWeight: '600', 
          marginBottom: '.5rem',
          color: '#374151',
          textTransform: 'capitalize'
        }}>
          {fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}
        </label>
        {isCheckbox ? (
          <input 
            ref={el => fieldRefs.current[fieldName] = el}
            type="checkbox"
          />
        ) : isSelect ? (
          <select ref={el => fieldRefs.current[fieldName] = el} style={inputStyle}>
            <option value="">{`Select ${fieldName}`}</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input 
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('price') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
            style={inputStyle}
          />
        )}
      </div>
    );
  };

  // ✅ PRODUCTION STYLES
  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fafbfc',
    fontSize: '16px',
    transition: 'border-color 0.2s'
  };

  const sectionStyle = {
    background: 'white',
    padding: '2.5rem',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
    marginBottom: '2rem'
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: '#ef4444', fontSize: '2rem' }}>🔐 Please Login</h2>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>Sign in to list your products</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      {message && (
        <div style={{
          background: message.includes('🎉') ? '#10b981' : message.includes('❌') ? '#ef4444' : '#3b82f6',
          color: 'white',
          padding: '1.25rem 2rem',
          borderRadius: '16px',
          marginBottom: '2rem',
          textAlign: 'center',
          fontWeight: '600',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem' }}>
        {/* MAIN FORM */}
        <form onSubmit={handleSubmit} style={sectionStyle}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '2.5rem' 
          }}>
            <h1 style={{ 
              fontSize: '2.5rem', 
              fontWeight: '800', 
              color: '#111827',
              margin: 0 
            }}>
              Add New Product
            </h1>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                {user?.name?.split(' ')[0] || 'Seller'}
              </div>
              <div style={{ fontSize: '.875rem', color: '#6b7280' }}>
                {dynamicFields.length} dynamic fields
              </div>
            </div>
          </div>

          {/* BASIC INFO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem' }}>
                Product Title *
              </label>
              <input 
                ref={el => fieldRefs.current.title = el}
                type="text" 
                placeholder="Tecno Camon 19 32GB Green - Brand New"
                style={{ ...inputStyle, fontSize: '18px', padding: '18px 20px' }}
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem' }}>
                Price (₦) *
              </label>
              <input 
                ref={el => fieldRefs.current.price = el}
                type="number" 
                placeholder="150000"
                style={{ ...inputStyle, fontSize: '18px', padding: '18px 20px' }}
                required 
              />
            </div>
          </div>

          {/* LOCATION & CONTACT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Category *</label>
              <select 
                ref={el => fieldRefs.current.category = el}
                onChange={(e) => setCategory(e.target.value)}
                style={{ ...inputStyle, background: 'white' }}
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>State</label>
              <select 
                ref={el => fieldRefs.current.state = el}
                onChange={(e) => setState(e.target.value)}
                style={{ ...inputStyle, background: 'white' }}
              >
                <option value="">Select State</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>City</label>
              <select ref={el => fieldRefs.current.city = el} style={{ ...inputStyle, background: 'white' }}>
                <option value="">Select City</option>
                {stateCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Phone</label>
              <input 
                ref={el => fieldRefs.current.phone = el}
                type="tel" 
                placeholder="08012345678"
                style={inputStyle}
              />
            </div>
          </div>

          {/* DYNAMIC FIELDS */}
          {dynamicFields.length > 0 && (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '2rem', 
              background: '#f8fafc', 
              borderRadius: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ 
                marginBottom: '1.5rem', 
                fontSize: '1.25rem', 
                fontWeight: '700',
                color: '#1e293b'
              }}>
                {category} Details ({dynamicFields.length} fields)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {dynamicFields.map(renderDynamicField)}
              </div>
            </div>
          )}

          {/* DESCRIPTION & EXCHANGE */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Description</label>
              <textarea 
                ref={el => fieldRefs.current.description = el}
                rows="4"
                placeholder="Describe your product condition, features, usage..."
                style={{ 
                  ...inputStyle, 
                  resize: 'vertical', 
                  fontFamily: 'inherit',
                  padding: '16px 20px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: '600' }}>
                <input 
                  ref={el => fieldRefs.current.negotiation = el}
                  type="checkbox"
                  style={{ width: '18px', height: '18px' }}
                />
                Negotiation Allowed
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: '600' }}>
                <input 
                  type="checkbox"
                  checked={exchangePossible}
                  onChange={(e) => setExchangePossible(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                Exchange Possible
              </label>
            </div>
          </div>

          {/* IMAGES */}
          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem', fontSize: '1.1rem' }}>
              🖼️ Product Images (Max 8)
            </label>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleImages}
              style={{
                width: '100%',
                padding: '1.5rem',
                border: '3px dashed #d1d5db',
                borderRadius: '16px',
                background: '#f8fafc',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            />
          </div>

          {imagesPreview.length > 0 && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '1.25rem', 
              marginBottom: '2.5rem' 
            }}>
              {imagesPreview.map((img, index) => (
                <div key={img.name} style={{ position: 'relative', height: '180px' }}>
                  <img 
                    src={img.preview} 
                    alt="Preview" 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '12px'
                    }} 
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    right: '12px',
                    background: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}>
                    {img.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '24px',
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              fontSize: '20px',
              fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 15px 35px rgba(16,185,129,0.4)',
              transition: 'all 0.3s ease'
            }}
          >
            {loading ? '📤 Publishing to Database...' : `🚀 Publish ${category || 'Product'}`}
          </button>
        </form>

        {/* PREVIEW SIDEBAR */}
        <div>
          <div style={sectionStyle}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '800', color: '#111827' }}>
              📊 Live Preview
            </h3>
            <div style={{ fontSize: '16px', lineHeight: '1.6', color: '#374151' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <span>Title:</span>
                <strong>{fieldRefs.current.title?.value?.substring(0, 25) || 'Enter title'}...</strong>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <span>Price:</span>
                <strong style={{ color: '#10b981', fontSize: '18px' }}>
                  ₦{parseInt(fieldRefs.current.price?.value || 0).toLocaleString()}
                </strong>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '12px'
              }}>
                <span>Category:</span>
                <strong style={{ color: '#3b82f6' }}>{category || 'Select'}</strong>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '1rem', 
                background: '#f8fafc', 
                borderRadius: '12px'
              }}>
                <span>Images:</span>
                <strong style={{ color: '#f59e0b' }}>{imagesPreview.length}/8</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;