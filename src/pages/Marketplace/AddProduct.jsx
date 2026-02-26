// src/pages/Marketplace/AddProduct.jsx - ✅ ALL CONFIGS + PERFECT UX
import React, { useState, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { categoryFields } from '../../config/categoryFields.js';
import { brands } from '../../config/brands.js';
import { colors } from '../../config/colors.js';
import { conditions, usedDetails } from '../../config/conditions.js';
import { engines } from '../../config/engines.js';
import { featuresByCategory } from '../../config/featuresByCategory.js';
import { fieldOptions } from '../../config/fieldOptions.js';
import { locationsByState } from '../../config/locationsByState.js';

const AddProduct = () => {
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);

  const { user, isAuthenticated } = useAuth0();

  const dynamicFields = category ? categoryFields[category] || [] : [];
  const categoryBrands = category ? brands[category] || [] : [];
  const categoryFeatures = category ? featuresByCategory[category] || [] : [];
  const stateCities = state ? locationsByState[state] || [] : [];

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    fieldRefs.current.category.value = newCategory;
  };

  const handleStateChange = (e) => {
    setState(e.target.value);
    fieldRefs.current.state.value = e.target.value;
  };

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }
    
    files.forEach(file => {
      const shortName = file.name.length > 25 ? 
        `${file.name.substring(0, 22)}...${file.name.split('.').pop()}` : 
        file.name;
        
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { 
        file, preview, name: shortName, originalName: file.name 
      }]);
    });
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    const img = imagesPreview[index];
    URL.revokeObjectURL(img.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const formData = {
      title: fieldRefs.current.title?.value || '',
      price: fieldRefs.current.price?.value || '',
      phone_number: fieldRefs.current.phone?.value || '',
      category: fieldRefs.current.category?.value || '',
      state: fieldRefs.current.state?.value || '',
      city: fieldRefs.current.city?.value || '',
      images: imagesPreview.map(img => img.originalName),
      dynamic_fields: {}
    };

    dynamicFields.forEach(field => {
      formData.dynamic_fields[field] = fieldRefs.current[field]?.value || '';
    });

    console.log('🎯 COMPLETE FORM DATA:', formData);

    if (!formData.title.trim() || !formData.price || parseFloat(formData.price) <= 0) {
      setMessage('❌ Title and valid price required');
      return;
    }

    setLoading(true);
    setMessage('🚀 Publishing...');

    setTimeout(() => {
      setMessage('🎉 Product published successfully!');
      
      // RESET EVERYTHING
      Object.keys(fieldRefs.current).forEach(key => {
        if (fieldRefs.current[key]) fieldRefs.current[key].value = '';
      });
      setCategory('');
      setState('');
      setImagesPreview([]);
      
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }, 2000);
  }, [dynamicFields, imagesPreview]);

  const renderField = useCallback((fieldName) => {
    const options = fieldOptions[fieldName] || 
                   (fieldName === 'brand' ? categoryBrands : []) ||
                   (fieldName === 'condition' ? conditions : []) ||
                   (fieldName === 'used_detail' ? usedDetails : []) ||
                   (fieldName === 'color' ? colors : []) ||
                   (fieldName === 'city' ? stateCities : []);

    const isSelect = options.length > 0;
    
    return (
      <div key={fieldName} style={{ flex: '1', minWidth: '250px' }}>
        <label style={{ 
          display: 'block', fontWeight: '600', marginBottom: '.75rem',
          color: '#374151', textTransform: 'capitalize'
        }}>
          {fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}
        </label>
        {isSelect ? (
          <select 
            ref={el => fieldRefs.current[fieldName] = el}
            style={{
              width: '100%', padding: '16px 20px', border: '2px solid #e5e7eb',
              borderRadius: '12px', background: 'white', fontSize: '16px'
            }}
          >
            <option value="">{`Select ${fieldName}`}</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type="text"
            placeholder={`Enter ${fieldName}`}
            style={{
              width: '100%', padding: '16px 20px', border: '2px solid #e5e7eb',
              borderRadius: '12px', background: '#fafbfc', fontSize: '16px'
            }}
          />
        )}
      </div>
    );
  }, [categoryBrands, stateCities]);

  if (!isAuthenticated) return <div style={{padding: '4rem', textAlign: 'center'}}><h2>🔐 Login Required</h2></div>;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      {message && (
        <div style={{
          background: message.includes('🎉') ? '#10b981' : '#ef4444',
          color: 'white', padding: '1.25rem 2rem', borderRadius: '16px',
          marginBottom: '2rem', textAlign: 'center', fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2.5rem' }}>
        <form onSubmit={handleSubmit} style={{
          background: 'white', padding: '3rem', borderRadius: '24px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2.75rem', fontWeight: '800', color: '#111827' }}>
              Add New Product
            </h1>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                {dynamicFields.length} fields active
              </div>
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>{category || 'Choose category'}</div>
            </div>
          </div>

          {/* BASIC FIELDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem', fontSize: '1.1rem' }}>
                Product Title *
              </label>
              <input ref={el => fieldRefs.current.title = el} type="text" 
                     placeholder="iPhone 15 Pro Max 256GB Space Black" 
                     style={{
                       width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb',
                       borderRadius: '16px', fontSize: '18px', background: '#fafbfc',
                       fontWeight: '500'
                     }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '700', marginBottom: '1rem', fontSize: '1.1rem' }}>
                Price (₦) *
              </label>
              <input ref={el => fieldRefs.current.price = el} type="number" 
                     placeholder="150000" 
                     style={{
                       width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb',
                       borderRadius: '16px', fontSize: '18px', background: '#fafbfc'
                     }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Category *</label>
              <select ref={el => fieldRefs.current.category = el} onChange={handleCategoryChange}
                      style={{ width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb', borderRadius: '16px', background: 'white', fontSize: '16px' }}>
                <option value="">Select Category</option>
                {Object.keys(categoryFields).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>State</label>
              <select ref={el => fieldRefs.current.state = el} onChange={handleStateChange}
                      style={{ width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb', borderRadius: '16px', background: 'white', fontSize: '16px' }}>
                <option value="">Select State</option>
                <option value="Lagos">Lagos</option>
                <option value="Abuja">Abuja</option>
                <option value="Kano">Kano</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>City</label>
              <select ref={el => fieldRefs.current.city = el}
                      style={{ width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb', borderRadius: '16px', background: 'white', fontSize: '16px' }}>
                <option value="">Select City</option>
                {stateCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Phone</label>
              <input ref={el => fieldRefs.current.phone = el} type="tel" placeholder="08012345678"
                     style={{ width: '100%', padding: '20px 24px', border: '2px solid #e5e7eb', borderRadius: '16px', background: '#fafbfc', fontSize: '16px' }} />
            </div>
          </div>

          {/* DYNAMIC FIELDS */}
          {dynamicFields.length > 0 && (
            <div style={{ marginBottom: '2.5rem', padding: '2.5rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', borderRadius: '20px' }}>
              <h3 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>
                📋 {category} Details ({dynamicFields.length} fields)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {dynamicFields.map(renderField)}
              </div>
            </div>
          )}

          {/* IMAGES */}
          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', fontWeight: '700', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
              🖼️ Product Images (Max 8)
            </label>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImages}
                   style={{ width: '100%', padding: '1.75rem', border: '3px dashed #cbd5e1', borderRadius: '20px', background: '#f8fafc', cursor: 'pointer', fontSize: '16px' }} />
          </div>

          {imagesPreview.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
              {imagesPreview.map((img, index) => (
                <div key={img.name} style={{ position: 'relative', height: '200px' }}>
                  <img src={img.preview} alt="Preview" style={{
                    width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px'
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '16px', left: '16px', right: '16px',
                    background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 12px',
                    borderRadius: '8px', fontSize: '13px', fontWeight: '600', textAlign: 'center'
                  }}>
                    {img.name}
                  </div>
                  <button type="button" onClick={() => removeImage(index)} style={{
                    position: 'absolute', top: '16px', right: '16px',
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: '#ef4444', color: 'white', border: 'none',
                    cursor: 'pointer', fontSize: '20px', fontWeight: 'bold'
                  }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '28px', background: loading ? '#9ca3af' : '#10b981',
            color: 'white', border: 'none', borderRadius: '24px',
            fontSize: '22px', fontWeight: '800', cursor: 'pointer',
            boxShadow: '0 20px 40px rgba(16,185,129,0.4)',
            transition: 'all 0.3s ease'
          }}>
            {loading ? '📤 Publishing Product...' : `🚀 Publish ${category || 'Product'}`}
          </button>
        </form>

        <div>
          <div style={{
            background: 'white', padding: '3rem', borderRadius: '24px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.12)'
          }}>
            <h3 style={{ marginBottom: '2rem', fontWeight: '800', color: '#111827' }}>📊 Live Preview</h3>
            <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>Title:</span>
                <span style={{ fontWeight: '600', color: '#059669' }}>{fieldRefs.current.title?.value?.substring(0, 30) || 'Enter title'}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>Price:</span>
                <span style={{ fontWeight: '700', fontSize: '18px', color: '#10b981' }}>
                  ₦{parseFloat(fieldRefs.current.price?.value || 0).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>Category:</span>
                <span style={{ fontWeight: '600' }}>{category || 'Select'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>Images:</span>
                <span style={{ fontWeight: '600', color: '#3b82f6' }}>{imagesPreview.length}/8</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;