// components/ProductLocationSection.jsx
import React from 'react';

const ProductLocationSection = ({ formData, handleInputChange, renderSelectField }) => (
  <div className="form-section">
    <h2>Location & Contact</h2>
    <div className="form-grid">
      {renderSelectField('state')}
      {renderSelectField('city')}
      <div className="form-group">
        <label>Phone Number</label>
        <input name="phone_number" value={formData.phone_number} onChange={handleInputChange} />
      </div>
      <div className="form-group">
        <label>Poster Name</label>
        <input name="poster_name" value={formData.poster_name} onChange={handleInputChange} />
      </div>
    </div>
  </div>
);

export default ProductLocationSection;