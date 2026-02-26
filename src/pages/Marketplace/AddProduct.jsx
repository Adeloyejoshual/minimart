// src/pages/Marketplace/AddProduct.jsx - ✅ BUILD FIXED
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './AddProduct.css';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '', price: '', category: '', condition: '', location: '',
    state: '', description: '', stock: '', brand: '', model: '', features: []
  });
  const [imagePreview, setImagePreview] = useState('');
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [products, setProducts] = useState([]);
  const fileInputRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/marketplace/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const uploadToCloudinary = (imageFile) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('upload_preset', '0HoyRB6wC0eba-Cbat0nhiIRoa8');

      fetch('https://api.cloudinary.com/v1_1/di6zeyneq/image/upload', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => resolve(data.secure_url))
      .catch(reject);
    });
  };

  const handleChange = async (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'images') {
      const newImages = Array.from(files);
      setImages(prev => [...prev, ...newImages]);
      if (files[0]) setImagePreview(URL.createObjectURL(files[0]));
      return;
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Product name required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price required';
    if (!formData.category) newErrors.category = 'Category required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || !termsAccepted) {
      setMessage('Please fix errors and accept terms');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let imageUrls = [];
      for (const image of images) {
        const url = await uploadToCloudinary(image);
        imageUrls.push(url);
      }

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock) || 0,
          images: imageUrls
        })
      });

      if (response.ok) {
        setMessage('🎉 Product published successfully!');
        fetchProducts();
        setFormData({ name: '', price: '', category: '', condition: '', location: '', state: '', description: '', stock: '', brand: '', model: '', features: [] });
        setImages([]);
        setImagePreview('');
        setTermsAccepted(false);
      } else {
        setMessage('❌ Failed to publish');
      }
    } catch (error) {
      setMessage('❌ Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="add-product-container">
      {message && (
        <div className="error-banner">
          <span>{message}</span>
          <button className="close-btn" onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="add-product-header">
        <h1>Add New Product</h1>
        <p>Complete Nigerian marketplace listing with glassmorphism UI</p>
      </div>

      <div className="add-product-main">
        {/* FORM SECTIONS */}
        <div className="form-sections">
          <div className="form-section">
            <h2>Product Details</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>Price (₦) *</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  className={errors.price ? 'error' : ''}
                />
                {errors.price && <span className="error-text">{errors.price}</span>}
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select name="category" value={formData.category} onChange={handleChange} className={errors.category ? 'error' : ''}>
                  <option value="">Select category</option>
                  <option value="electronics">Electronics</option>
                  <option value="vehicles">Vehicles</option>
                  <option value="fashion">Fashion</option>
                </select>
              </div>

              <div className="form-group">
                <label>Stock</label>
                <input name="stock" type="number" min="0" value={formData.stock} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Images</h2>
            <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-placeholder">
                <div className="upload-icon">📸</div>
                <p>Click to upload</p>
                <small>PNG, JPG up to 10MB</small>
              </div>
              {imagePreview && (
                <div className="image-previews">
                  {images.map((img, index) => (
                    <div key={index} className="image-preview">
                      <img src={imagePreview} alt="Preview" />
                      <button className="remove-image" onClick={() => removeImage(index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              name="images"
              type="file"
              multiple
              accept="image/*"
              onChange={handleChange}
              className="hidden"
            />
          </div>

          <div className="form-group full-width">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="5"
            />
          </div>

          <div className="terms-checkbox" onClick={() => setTermsAccepted(!termsAccepted)}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>I agree to Terms & Conditions</span>
          </div>

          <div className="publish-buttons">
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="publish-panel">
            <h3>Quick Checklist</h3>
            <div className="checklist">
              <div className="checklist-item">
                <div className="check-icon">○</div>
                <span>Complete all fields</span>
              </div>
              <div className="checklist-item">
                <div className="check-icon">○</div>
                <span>Upload images</span>
              </div>
              <div className="checklist-item">
                <div className="check-icon">○</div>
                <span>Accept terms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      {products.length > 0 && (
        <div style={{ marginTop: '4rem', padding: '2rem' }}>
          <h2>Recently Added ({products.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {products.slice(0, 6).map(product => (
              <div key={product._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                <img src={product.image || product.images?.[0]} alt={product.name} style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                <h3 style={{ margin: '0.5rem 0' }}>{product.name}</h3>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                  ₦{Number(product.price).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProduct;