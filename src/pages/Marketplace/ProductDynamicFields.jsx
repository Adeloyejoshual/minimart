// components/ProductDynamicFields.jsx
import React from 'react';

const ProductDynamicFields = ({ formData, computedFields, renderSelectField, selectedFeatures, toggleFeature }) => {
  if (!formData.category || !computedFields.visibleFields.length) return null;

  return (
    <div className="form-section">
      <h2>{formData.category} Details</h2>
      <div className="form-grid">
        {computedFields.visibleFields.map(field => renderSelectField(field))}
      </div>
      
      {computedFields.currentFeatures?.length > 0 && (
        <div className="features-grid">
          {computedFields.currentFeatures.map(feature => (
            <label key={feature} className="feature-checkbox">
              <input
                type="checkbox"
                checked={selectedFeatures.includes(feature)}
                onChange={() => toggleFeature(feature)}
              />
              {feature}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductDynamicFields;