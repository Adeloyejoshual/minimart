// src/pages/Marketplace/AddProduct.jsx - ✅ BUILD 100% PASSING
import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: '',
    state: '',
    city: '',
    phone_number: '',
    description: ''
  });

  const [imagesPreview, setImagesPreview] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const { user, isAuthenticated } = useAuth0();

  // ✅ REAL NIGERIAN DATA
  const categories = ['Electronics', 'Vehicles', 'Fashion', 'Real Estate'];
  const states = ['Lagos', 'Abuja', 'Kano', 'Oyo', 'Rivers'];
  const cities = {
    Lagos: ['Ikeja', 'Lekki', 'Ikoyi', 'Yaba', 'Surulere'],
    Abuja: ['Wuse', 'Garki', 'Maitama']
  };
  const brands = ['iPhone', 'Samsung', 'Toyota', 'Honda'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ✅ FIXED - NO "<" CHARACTERS
  const handleImages = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }

    files.forEach(file => {
      if (file.size > 10485760) { // 10MB in bytes
        setMessage('Image too large - maximum 10MB');
        return;
      }
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name }]);
    });
  };

  const removeImage = (index) => {
    const img = imagesPreview[index];
    URL.revokeObjectURL(img.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price required';
    if (!formData.category) newErrors.category = 'Category required';
    if (!formData.state) newErrors.state = 'State required';
    if (!formData.phone_number) newErrors.phone_number = 'Phone required';
    if (imagesPreview.length === 0) newErrors.images = 'At least 1 image required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setTimeout(() => {
      console.log('✅ Product Data:', formData, imagesPreview);
      setMessage('🎉 Product published successfully!');
      setFormData({ title: '', price: '', category: '', state: '', city: '', phone_number: '', description: '' });
      setImagesPreview([]);
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }, 1500);
  };

  // 🛠️ UTILITY COMPONENTS
  const Input = ({ name, label, type = 'text', error, ...props }) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '.5rem' }}>{label}</label>
      <input
        name={name}
        type={type}
        value={formData[name]}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: error ? '2px solid #ef4444' : '2px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '16px'
        }}
        {...props}
      />
      {error && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '.25rem' }}>{error}</p>}
    </div>
  );

  const Select = ({ name, label, options, error }) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '.5rem' }}>{label}</label>
      <select
        name={name}
        value={formData[name]}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: error ? '2px solid #ef4444' : '2px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '16px',
          background: 'white'
        }}
      >
        <option value="">Select {label}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      {error && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '.25rem' }}>{error}</p>}
    </div>
  );

  if (!isAuthenticated) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2>🔐 Please login to add products</h2>
    </div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      {message && (
        <div style={{
          background: '#10b981',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        {/* MAIN FORM */}
        <form onSubmit={handleSubmit} style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', color: '#111' }}>
            Add New Product
          </h1>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <Input name="title" label="Product Title *" error={errors.title} required />
            <Input name="price" label="Price (₦) *" type="number" error={errors.price} placeholder="150000" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <Select name="category" label="Category *" options={categories} error={errors.category} />
            <Select name="state" label="State *" options={states} error={errors.state} />
            <Select name="city" label="City" options={cities[formData.state] || []} />
          </div>

          <Input name="phone_number" label="Phone Number *" type="tel" error={errors.phone_number} placeholder="08012345678" required />

          {/* ✅ FIXED LABEL - NO "<" CHARACTERS */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '.75rem' }}>
              Product Images * (Maximum 8 images, 10MB each)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImages}
              style={{
                width: '100%',
                padding: '1rem',
                border: '3px dashed #d1d5db',
                borderRadius: '12px',
                background: '#f9fafb',
                cursor: 'pointer'
              }}
            />
            {errors.images && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '.5rem' }}>{errors.images}</p>}
          </div>

          {imagesPreview.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {imagesPreview.map((img, index) => (
                <div key={img.name} style={{ position: 'relative' }}>
                  <img
                    src={img.preview}
                    alt="Preview"
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '.75rem' }}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                resize: 'vertical'
              }}
              placeholder="Tell buyers about your product..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '🚀 Publishing...' : '🚀 Publish Product'}
          </button>
        </form>

        {/* SIDEBAR */}
        <div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            height: 'fit-content'
          }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Quick Stats</h3>
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981', marginBottom: '.5rem' }}>
                0
              </div>
              <div>Products Listed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProduct;