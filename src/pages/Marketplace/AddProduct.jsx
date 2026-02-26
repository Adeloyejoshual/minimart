// src/pages/Marketplace/AddProduct.jsx - ✅ DYNAMIC FIELDS + FIXED IMAGES
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { categoryFields } from '../../config/categoryFields.js'; // ✅ YOUR CONFIG

const AddProduct = () => {
  const [category, setCategory] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // ✅ DYNAMIC FIELD REFS
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);

  const { user, isAuthenticated } = useAuth0();

  // ✅ REAL DATA FOR FIELDS
  const fieldOptions = {
    brand: ['iPhone', 'Samsung', 'Toyota', 'Honda', 'Nike', 'Apple', 'HP', 'Dell'],
    model: ['iPhone 15', 'Galaxy S24', 'Corolla', 'Camry', 'Air Max', 'MacBook Pro'],
    condition: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    ram: ['4GB', '8GB', '16GB', '32GB'],
    storage: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    color: ['Black', 'White', 'Blue', 'Red', 'Gold'],
    engine: ['1.5L', '2.0L', '2.5L'],
    fuel_type: ['Petrol', 'Diesel', 'Electric'],
    size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    age_range: ['0-3 months', '3-6 months', '6-12 months', '1-2 years']
  };

  // ✅ DYNAMIC FIELDS BASED ON CATEGORY
  const dynamicFields = category ? categoryFields[category] || [] : [];

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    
    // Reset all field refs when category changes
    Object.keys(fieldRefs.current).forEach(key => {
      if (fieldRefs.current[key]) fieldRefs.current[key].value = '';
    });
  };

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }
    
    files.forEach(file => {
      // ✅ TRUNCATE FILENAME - SHOW "image.jpg" instead of full path
      const shortName = file.name.length > 25 ? 
        file.name.substring(0, 22) + '...' + file.name.split('.').pop() : 
        file.name;
        
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { 
        file, 
        preview, 
        name: shortName,  // ✅ FIXED SHORT NAME
        originalName: file.name 
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
    
    // ✅ COLLECT ALL DYNAMIC FIELD VALUES
    const formData = {
      title: fieldRefs.current.title?.value || '',
      price: fieldRefs.current.price?.value || '',
      phone_number: fieldRefs.current.phone?.value || '',
      category,
      images: imagesPreview.map(img => img.originalName),
      dynamic_fields: {}
    };

    // ✅ CAPTURE ALL DYNAMIC FIELDS
    dynamicFields.forEach(field => {
      formData.dynamic_fields[field] = fieldRefs.current[field]?.value || '';
    });

    console.log('🚀 FULL FORM DATA:', formData);

    // ✅ VALIDATION
    if (!formData.title.trim()) {
      setMessage('❌ Title required');
      fieldRefs.current.title?.focus();
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setMessage('❌ Valid price required');
      fieldRefs.current.price?.focus();
      return;
    }

    setLoading(true);
    setMessage('🚀 Publishing product...');

    setTimeout(() => {
      setMessage('🎉 Product published successfully!');
      
      // RESET FORM
      fieldRefs.current.title.value = '';
      fieldRefs.current.price.value = '';
      fieldRefs.current.phone.value = '';
      setCategory('');
      setImagesPreview([]);
      
      fieldRefs.current.title?.focus();
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }, 2000);
  }, [category, dynamicFields, imagesPreview]);

  const renderDynamicField = useCallback((fieldName) => {
    const options = fieldOptions[fieldName] || [];
    const isSelect = options.length > 0;
    
    return (
      <div key={fieldName} style={{ marginBottom: '1.5rem' }}>
        <label style={{ 
          display: 'block', 
          fontWeight: '600', 
          marginBottom: '.75rem',
          color: '#374151'
        }}>
          {fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}
        </label>
        {isSelect ? (
          <select 
            ref={el => fieldRefs.current[fieldName] = el}
            style={{
              width: '100%',
              padding: '16px 20px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              background: 'white',
              fontSize: '16px'
            }}
          >
            <option value="">Select {fieldName}</option>
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
              width: '100%',
              padding: '16px 20px',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              background: '#fafbfc',
              fontSize: '16px'
            }}
          />
        )}
      </div>
    );
  }, [fieldOptions]);

  if (!isAuthenticated) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2>🔐 Login Required</h2>
    </div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      {message && (
        <div style={{
          background: message.includes('🎉') ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '24px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#111827' }}>
              Add New Product
            </h1>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#059669' }}>
                {dynamicFields.length} dynamic fields loaded
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                {category || 'Select category'}
              </div>
            </div>
          </div>

          {/* BASIC FIELDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Product Title *</label>
              <input
                ref={el => fieldRefs.current.title = el}
                type="text"
                placeholder="iPhone 15 Pro Max 256GB - Like New"
                style={{
                  width: '100%', padding: '18px 20px', border: '2px solid #e5e7eb',
                  borderRadius: '16px', fontSize: '16px', background: '#fafbfc'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Price (₦) *</label>
              <input
                ref={el => fieldRefs.current.price = el}
                type="number"
                placeholder="150000"
                style={{
                  width: '100%', padding: '18px 20px', border: '2px solid #e5e7eb',
                  borderRadius: '16px', fontSize: '16px', background: '#fafbfc'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Category *</label>
              <select 
                ref={el => fieldRefs.current.category = el}
                onChange={handleCategoryChange}
                style={{
                  width: '100%', padding: '18px 20px', border: '2px solid #e5e7eb',
                  borderRadius: '16px', background: 'white', fontSize: '16px'
                }}
              >
                <option value="">Select Category</option>
                {Object.keys(categoryFields).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>State</label>
              <select ref={el => fieldRefs.current.state = el} style={{
                width: '100%', padding: '18px 20px', border: '2px solid #e5e7eb',
                borderRadius: '16px', background: 'white', fontSize: '16px'
              }}>
                <option value="">Select State</option>
                <option value="Lagos">Lagos</option>
                <option value="Abuja">Abuja</option>
                <option value="Kano">Kano</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Phone Number</label>
              <input
                ref={el => fieldRefs.current.phone = el}
                type="tel"
                placeholder="08012345678"
                style={{
                  width: '100%', padding: '18px 20px', border: '2px solid #e5e7eb',
                  borderRadius: '16px', background: '#fafbfc', fontSize: '16px'
                }}
              />
            </div>
          </div>

          {/* ✅ DYNAMIC FIELDS SECTION */}
          {dynamicFields.length > 0 && (
            <div style={{ marginBottom: '2.5rem', padding: '2rem', background: '#f8fafc', borderRadius: '16px' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '700' }}>
                {category} Details ({dynamicFields.length} fields)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {dynamicFields.map(fieldName => renderDynamicField(fieldName))}
              </div>
            </div>
          )}

          {/* IMAGES - ✅ SHORT NAMES */}
          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '1rem' }}>
              Product Images (Max 8)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImages}
              style={{
                width: '100%', padding: '1.5rem', border: '3px dashed #d1d5db',
                borderRadius: '16px', background: '#f8fafc', cursor: 'pointer', fontSize: '16px'
              }}
            />
          </div>

          {imagesPreview.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '1.5rem', marginBottom: '2.5rem'
            }}>
              {imagesPreview.map((img, index) => (
                <div key={img.name} style={{ position: 'relative' }}>
                  <img src={img.preview} alt="Preview" style={{
                    width: '100%', height: '160px', objectFit: 'cover', borderRadius: '16px'
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '12px', left: '12px', right: '12px',
                    background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px',
                    borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontWeight: '500'
                  }}>
                    {img.name} {/* ✅ SHORT NAME DISPLAY */}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute', top: '12px', right: '12px',
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: '#ef4444', color: 'white', border: 'none',
                      cursor: 'pointer', fontSize: '18px', fontWeight: 'bold'
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
              width: '100%', padding: '24px', background: loading ? '#9ca3af' : '#10b981',
              color: 'white', border: 'none', borderRadius: '20px',
              fontSize: '20px', fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(16,185,129,0.3)'
            }}
          >
            {loading ? '📤 Publishing Product...' : `🚀 Publish ${category || 'Product'}`}
          </button>
        </form>

        <div>
          <div style={{
            background: 'white', padding: '2.5rem', borderRadius: '24px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '700' }}>Preview</h3>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              <div><strong>Title:</strong> {fieldRefs.current.title?.value || 'Enter title'}</div>
              <div><strong>Price:</strong> ₦{fieldRefs.current.price?.value || 0}</div>
              <div><strong>Category:</strong> {category || 'Select'}</div>
              <div><strong>Fields:</strong> {dynamicFields.length}</div>
              <div><strong>Images:</strong> {imagesPreview.length}/8</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;