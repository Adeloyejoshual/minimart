// src/pages/Marketplace/AddProduct.jsx - ✅ PERFECT KEYBOARD TYPING
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AddProduct = () => {
  // ✅ UNCONTROLLED INPUTS - refs capture values on submit
  const titleRef = useRef('');
  const priceRef = useRef('');
  const phoneRef = useRef('');
  const categoryRef = useRef('');
  const stateRef = useRef('');
  const cityRef = useRef('');
  const descriptionRef = useRef('');

  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const { user, isAuthenticated } = useAuth0();

  const categories = ['Electronics', 'Vehicles', 'Fashion', 'Real Estate'];
  const states = ['Lagos', 'Abuja', 'Kano'];
  const cities = ['Ikeja', 'Lekki', 'Wuse', 'Garki'];

  // ✅ OPTIMIZED IMAGE HANDLER
  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images');
      return;
    }
    files.forEach(file => {
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name }]);
    });
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    setImagesPreview(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      prev[index]?.preview && URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
  }, []);

  // ✅ COLLECT FORM DATA ON SUBMIT ONLY
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // ✅ GET VALUES FROM REFS - NO LAG
    const formData = {
      title: titleRef.current.value,
      price: priceRef.current.value,
      phone_number: phoneRef.current.value,
      category: categoryRef.current.value,
      state: stateRef.current.value,
      city: cityRef.current.value,
      description: descriptionRef.current.value,
      images: imagesPreview.map(img => img.name)
    };

    console.log('🎯 FORM SUBMITTED:', formData);

    // ✅ SIMPLE VALIDATION
    if (!formData.title.trim()) {
      setMessage('❌ Title is required');
      titleRef.current.focus();
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setMessage('❌ Valid price required');
      priceRef.current.focus();
      return;
    }

    setLoading(true);
    setMessage('🚀 Publishing...');

    // ✅ SIMULATE API CALL
    setTimeout(() => {
      console.log('✅ SUCCESS:', formData);
      setMessage('🎉 Product published successfully!');
      
      // Reset form
      titleRef.current.value = '';
      priceRef.current.value = '';
      phoneRef.current.value = '';
      categoryRef.current.value = '';
      stateRef.current.value = '';
      cityRef.current.value = '';
      descriptionRef.current.value = '';
      setImagesPreview([]);
      
      titleRef.current.focus();
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }, 1500);
  }, [imagesPreview]);

  if (!isAuthenticated) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2>🔐 Login Required</h2>
    </div>;
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '2rem', 
      fontFamily: 'system-ui, sans-serif' 
    }}>
      {message && (
        <div style={{
          background: message.includes('🎉') ? '#10b981' : message.includes('❌') ? '#ef4444' : '#3b82f6',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        {/* MAIN FORM */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          padding: '2.5rem',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)'
        }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            color: '#111827', 
            marginBottom: '2rem' 
          }}>
            Add New Product
          </h1>

          {/* ✅ UNCONTROLLED INPUTS - PERFECT TYPING */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>
                Product Title *
              </label>
              <input
                ref={titleRef}
                type="text"
                placeholder="iPhone 15 Pro Max - Perfect condition"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '16px',
                  background: '#fafbfc',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>
                Price (₦) *
              </label>
              <input
                ref={priceRef}
                type="number"
                placeholder="150000"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '16px',
                  background: '#fafbfc'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>Category *</label>
              <select ref={categoryRef} style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                background: 'white',
                fontSize: '16px'
              }}>
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>State *</label>
              <select ref={stateRef} style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                background: 'white',
                fontSize: '16px'
              }}>
                <option value="">Select State</option>
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>City</label>
              <select ref={cityRef} style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                background: 'white',
                fontSize: '16px'
              }}>
                <option value="">Select City</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>
              Phone Number *
            </label>
            <input
              ref={phoneRef}
              type="tel"
              placeholder="08012345678"
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                background: '#fafbfc'
              }}
            />
          </div>

          {/* IMAGES */}
          <div style={{ marginBottom: '2rem' }}>
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
                width: '100%',
                padding: '1.25rem',
                border: '3px dashed #d1d5db',
                borderRadius: '12px',
                background: '#f8fafc',
                cursor: 'pointer'
              }}
            />
          </div>

          {imagesPreview.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {imagesPreview.map((img, index) => (
                <div key={img.name} style={{ position: 'relative' }}>
                  <img src={img.preview} alt="Preview" style={{
                    width: '100%',
                    height: '140px',
                    objectFit: 'cover',
                    borderRadius: '12px'
                  }} />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '.75rem' }}>
              Description
            </label>
            <textarea
              ref={descriptionRef}
              rows="4"
              placeholder="Tell buyers about your product..."
              style={{
                width: '100%',
                padding: '16px 20px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: '#fafbfc'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '20px',
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '📤 Publishing...' : '🚀 Publish Product'}
          </button>
        </form>

        {/* SIDEBAR */}
        <div>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: '700' }}>Quick Tips</h3>
            <ul style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.7' }}>
              <li>✅ Title & Price required</li>
              <li>📱 Add phone number</li>
              <li>🖼️ Max 8 images</li>
              <li>⭐ Good photos sell faster</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;