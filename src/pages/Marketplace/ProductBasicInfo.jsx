// components/ProductBasicInfo.jsx
import React from 'react';

const ProductBasicInfo = ({ formData, errors, touched, handleInputChange, handleBlur, renderSelectField }) => (
  <div className="form-section">
    <h2>Basic Information</h2>
    <div className="form-grid">
      <div className="form-group">
        <label>Product Title *</label>
        <input
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={errors.title ? 'error' : ''}
        />
        {errors.title && touched.title && <span className="error-text">{errors.title}</span>}
      </div>
      
      <div className="form-group">
        <label>Price (₦) *</label>
        <input
          name="price"
          type="number"
          value={formData.price}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={errors.price ? 'error' : ''}
        />
        {errors.price && touched.price && <span className="error-text">{errors.price}</span>}
      </div>
      
      {renderSelectField('category')}
    </div>
  </div>
);

export default ProductBasicInfo;