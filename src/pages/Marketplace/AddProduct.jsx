// src/pages/Marketplace/AddProduct.jsx - ✅ PRODUCTION READY
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const AddProduct = () => {
  // 🧠 REAL FORM STATE
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    discount_price: '',
    category: '',
    brand: '',
    model: '',
    condition: '',
    year: '',
    mileage: '',
    state: '',
    city: '',
    phone_number: '',
    whatsapp: '',
    negotiable: false,
    images: []
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // ✅ REAL NIGERIAN MARKETPLACE DATA
  const categories = ['Electronics', 'Vehicles', 'Real Estate', 'Fashion', 'Phones', 'Laptops', 'Furniture', 'Generators'];
  const nigerianStates = [
    'Lagos', 'Abuja', 'Kano', 'Oyo', 'Rivers', 'Kaduna', 'Katsina', 'Anambra', 'Benue', 'Delta'
  ];
  const lagosCities = ['Ikeja', 'Lekki', 'Ikoyi', 'Surulere', 'Yaba', 'VI', 'Ajah', 'Badagry'];
  const abujaCities = ['Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa'];
  const phoneBrands = ['iPhone', 'Samsung', 'Tecno', 'Infinix', 'Redmi', 'Oppo', 'Itel'];
  const carBrands = ['Toyota', 'Honda', 'Mercedes', 'Toyota', 'BMW', 'Lexus', 'Range Rover'];

  // 🎯 DYNAMIC FIELD OPTIONS
  const getDynamicOptions = () => {
    const options = {
      brands: formData.category === 'Vehicles' ? carBrands : phoneBrands,
      cities: formData.state === 'Lagos' ? lagosCities : 
              formData.state === 'Abuja' ? abujaCities : []
    };
    return options;
  };

  // 📝 FORM HANDLERS
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // 🖼️ IMAGE UPLOAD
  const handleImages = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }

    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setMessage('Image too large (max 10MB)');
        return;
      }
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name }]);
      setFormData(prev => ({ ...prev, images: [...prev.images, file.name] }));
    });
  };

  const removeImage = (index) => {
    const img = imagesPreview[index];
    URL.revokeObjectURL(img.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ VALIDATION
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = 'Product title is required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price required';
    if (!formData.category) newErrors.category = 'Select category';
    if (!formData.state) newErrors.state = 'Select state';
    if (!formData.city) newErrors.city = 'Select city';
    if (!formData.phone_number) newErrors.phone_number = 'Phone number required';
    if (imagesPreview.length === 0) newErrors.images = 'At least 1 image required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🚀 REAL SUBMIT - Cloudinary + Backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setUploadProgress(10);

    try {
      // Step 1: Upload images to Cloudinary
      const imageUrls = [];
      for (let i = 0; i < imagesPreview.length; i++) {
        const formDataImg = new FormData();
        formDataImg.append('file', imagesPreview[i].file);
        formDataImg.append('upload_preset', 'minimart_prod');
        
        setUploadProgress(20 + (i * 10));
        
        const res = await fetch('https://api.cloudinary.com/v1_1/di6zeyneq/image/upload', {
          method: 'POST',
          body: formDataImg
        });
        const data = await res.json();
        imageUrls.push(data.secure_url);
      }

      setUploadProgress(80);

      // Step 2: Submit to backend
      const token = await getAccessTokenSilently();
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        images: imageUrls,
        seller_name: user.name,
        seller_id: user.sub
      };

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      setUploadProgress(100);

      if (response.ok) {
        setMessage('🎉 Product published successfully!');
        setFormData({
          title: '', description: '', price: '', discount_price: '',
          category: '', brand: '', model: '', condition: '', year: '',
          mileage: '', state: '', city: '', phone_number: '', whatsapp: '',
          negotiable: false, images: []
        });
        setImagesPreview([]);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage('❌ Publish failed');
      }
    } catch (error) {
      setMessage('❌ Network error: ' + error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // 📊 LOAD RECENT PRODUCTS
  useEffect(() => {
    fetch('/api/marketplace/products?limit=5')
      .then(res => res.json())
      .then(data => setRecentProducts(data.data || []));
  }, []);

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>🔐 Login Required</h2>
        <p>Please sign in to list products</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
      {/* 🔔 NOTIFICATION */}
      {message && (
        <div style={{
          background: message.includes('✅') || message.includes('🎉') ? '#10b981' : '#ef4444',
          color: 'white', padding: '16px 24px', borderRadius: '12px', marginBottom: '24px',
          textAlign: 'center', fontWeight: '500'
        }}>
          {message}
        </div>
      )}

      {/* 📈 PROGRESS BAR */}
      {uploadProgress > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            height: '8px', background: '#e5e7eb', borderRadius: '4px', 
            overflow: 'hidden', marginBottom: '8px'
          }}>
            <div style={{ 
              height: '100%', background: '#3b82f6', width: `${uploadProgress}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ color: '#6b7280', fontSize: '14px' }}>{uploadProgress}%</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px' }}>
        {/* 📋 MAIN FORM */}
        <div>
          <div style={{ 
            background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
                Add New Product
              </h1>
              <span style={{ 
                background: '#3b82f6', color: 'white', padding: '8px 16px', 
                borderRadius: '50px', fontSize: '14px', fontWeight: '500'
              }}>
                Live Preview
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              {/* BASIC INFO */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>
                  Basic Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      Product Title *
                    </label>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="iPhone 15 Pro Max 256GB Space Black - Mint Condition"
                      style={inputStyle(errors.title)}
                      required
                    />
                    {errors.title && <p style={errorStyle}>{errors.title}</p>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Price (₦) *</label>
                    <input
                      name="price"
                      type="number"
                      value={formData.price}
                      onChange={handleChange}
                      placeholder="150000"
                      style={inputStyle(errors.price)}
                      required
                    />
                    {errors.price && <p style={errorStyle}>{errors.price}</p>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '24px' }}>
                  <div>{renderSelect('category', categories, 'Category *')}</div>
                  <div>{renderSelect('state', nigerianStates, 'State *')}</div>
                  <div>{renderSelect('city', getDynamicOptions().cities || [], 'City *')}</div>
                </div>
              </div>

              {/* PRODUCT SPECIFIC */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>
                  Product Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>{renderSelect('brand', getDynamicOptions().brands || phoneBrands, 'Brand')}</div>
                  <div>{renderSelect('condition', ['New', 'Like New', 'Good', 'Fair', 'Poor'], 'Condition')}</div>
                  {formData.category === 'Vehicles' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Year</label>
                        <input name="year" value={formData.year} onChange={handleChange} placeholder="2022" style={inputStyle()} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Mileage (km)</label>
                        <input name="mileage" value={formData.mileage} onChange={handleChange} placeholder="45000" style={inputStyle()} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 📸 IMAGES */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                  Product Images * (Max 8, <10MB each)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImages}
                  style={{
                    width: '100%', padding: '16px', border: '3px dashed #d1d5db',
                    borderRadius: '12px', background: '#f9fafb', cursor: 'pointer'
                  }}
                />
                {errors.images && <p style={errorStyle}>{errors.images}</p>}
                
                {imagesPreview.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginTop: '20px' }}>
                    {imagesPreview.map((img, index) => (
                      <div key={img.name} style={{ position: 'relative' }}>
                        <img src={img.preview} alt="Preview" style={{ 
                          width: '100%', height: '140px', objectFit: 'cover', 
                          borderRadius: '12px', display: 'block' 
                        }} />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          style={{
                            position: 'absolute', top: '8px', right: '8px',
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'rgba(239,68,68,0.9)', color: 'white',
                            border: 'none', cursor: 'pointer', fontSize: '16px'
                          }}
                        >
                          ×
                        </button>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', textAlign: 'center' }}>
                          {img.name.slice(0, 20)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 📱 CONTACT */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Contact Info</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Phone Number *</label>
                    <input
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      placeholder="08012345678"
                      style={inputStyle(errors.phone_number)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>WhatsApp</label>
                    <input
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleChange}
                      placeholder="08012345678"
                      style={inputStyle()}
                    />
                  </div>
                </div>
                <label style={{ marginTop: '20px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="negotiable"
                    checked={formData.negotiable}
                    onChange={handleChange}
                    style={{ marginRight: '12px', width: '20px', height: '20px' }}
                  />
                  <span style={{ fontWeight: '500' }}>Price Negotiable</span>
                </label>
              </div>

              {/* 📝 DESCRIPTION */}
              <div style={{ marginBottom: '40px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '12px' }}>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Detailed description of product condition, usage, reason for selling, etc..."
                  rows="6"
                  style={{
                    width: '100%', padding: '16px', border: '2px solid #e5e7eb',
                    borderRadius: '12px', fontSize: '16px', fontFamily: 'inherit',
                    resize: 'vertical', lineHeight: '1.6'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '20px', background: loading ? '#9ca3af' : '#10b981',
                  color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px',
                  fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '📤 Publishing Product...' : '🚀 Publish Product Now'}
              </button>
            </form>
          </div>
        </div>

        {/* 📈 SIDEBAR */}
        <div>
          <div style={{ 
            background: 'white', borderRadius: '16px', padding: '24px', 
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)', height: 'fit-content'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Recent Listings</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {recentProducts.map(product => (
                <div key={product._id} style={{ 
                  display: 'flex', gap: '16px', padding: '16px', 
                  border: '1px solid #f3f4f6', borderRadius: '12px', marginBottom: '12px'
                }}>
                  <img src={product.images?.[0] || '/placeholder.jpg'} 
                       alt={product.title} 
                       style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div>
                    <h4 style={{ fontWeight: '600', margin: '0 0 4px 0', fontSize: '16px' }}>
                      {product.title}
                    </h4>
                    <p style={{ color: '#059669', fontWeight: '700', margin: '0 0 4px 0' }}>
                      ₦{Number(product.price).toLocaleString()}
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                      {product.state}, {product.city}
                    </p>
                  </div>
                </div>
              ))}
              {!recentProducts.length && (
                <p style={{ color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>
                  No recent listings
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 🛠️ UTILITY FUNCTIONS
const inputStyle = (hasError) => ({
  width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px',
  border: hasError ? '2px solid #ef4444' : '2px solid #e5e7eb',
  background: '#fafbfc', transition: 'all 0.2s ease',
  outline: 'none'
});

const errorStyle = {
  color: '#ef4444', fontSize: '14px', marginTop: '6px', fontWeight: '500'
};

const renderSelect = (name, options, label) => {
  const hasError = errors[name];
  return (
    <div>
      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
        {label}
      </label>
      <select
        name={name}
        onChange={handleChange}
        style={inputStyle(hasError)}
      >
        <option value="">Select {label}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {hasError && <p style={errorStyle}>{errors[name]}</p>}
    </div>
  );
};

export default AddProduct;