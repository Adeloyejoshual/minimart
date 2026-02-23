// src/components/AddProduct/ProductDetailsSection.jsx
// v21 - PRODUCTION READY, PERFECT PARENT MATCH

import React from "react";

export default function ProductDetailsSection({
  form,
  onFieldChange,
  categoryFields,
  brands,
  models,
  conditions,
  usedDetails,
  ramOptions,
  storageOptions,
  colors,
  sims,
  years,
  engines,
  fuelTypes,
  featuresByCategory,
  errors,
  touched
}) {
  const visibleFields = categoryFields[form.category] || [];
  const categoryBrands = brands[form.category] || [];
  const categoryModels = models[form.category]?.[form.brand] || [];
  const categoryFeatures = featuresByCategory[form.category] || [];

  const getFieldOptions = (field) => {
    const optionsMap = {
      condition: conditions,
      used_detail: usedDetails,
      ram: ramOptions,
      storage: storageOptions,
      color: colors,
      sim: sims,
      year: years,
      engine: engines,
      fuel_type: fuelTypes
    };
    return optionsMap[field] || [];
  };

  const FieldRenderer = ({ field, value, options = [], showLabel = true }) => {
    const hasError = touched?.[field] && errors?.[field];
    const safeValue = value ?? "";
    
    const labelText = field
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
    
    const baseClass = `w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-blue-500 focus:border-blue-500 ${
      hasError ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
    }`;

    return (
      <div className="form-group space-y-2">
        {showLabel && (
          <label htmlFor={`field-${field}`} className="block text-sm font-medium text-gray-700">
            {labelText} {visibleFields.includes(field) && "*"}
          </label>
        )}
        
        {field === "features" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {options.map(option => (
              <label key={option} className="flex items-center p-3 rounded-xl hover:bg-gray-50 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={(form.features || []).includes(option)}
                  onChange={(e) => {
                    const safeFeatures = form.features || [];
                    const updated = e.target.checked
                      ? [...safeFeatures, option]
                      : safeFeatures.filter(f => f !== option);
                    onFieldChange("features", updated);
                  }}
                  className="mr-3 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm group-hover:text-blue-600">{option}</span>
              </label>
            ))}
          </div>
        ) : (
          <div>
            {["year", "ram", "mileage", "bedrooms", "bathrooms"].includes(field) ? (
              <input
                id={`field-${field}`}
                type="number"
                min="0"
                value={safeValue}
                onChange={(e) => onFieldChange(field, e.target.value)}
                className={baseClass}
                placeholder={`Enter ${labelText.toLowerCase()}`}
              />
            ) : options.length > 0 ? (
              <select
                id={`field-${field}`}
                value={safeValue}
                onChange={(e) => onFieldChange(field, e.target.value)}
                className={baseClass}
              >
                <option value="">Select {labelText}</option>
                {options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                id={`field-${field}`}
                type="text"
                value={safeValue}
                onChange={(e) => onFieldChange(field, e.target.value)}
                className={baseClass}
                placeholder={`Enter ${labelText.toLowerCase()}`}
              />
            )}
            {hasError && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors[field]}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent border-b pb-4">
        📦 Product Details
      </h2>

      <FieldRenderer field="title" value={form.title} options={[]} />
      <FieldRenderer field="category" value={form.category} options={Object.keys(categoryFields)} />

      {categoryBrands.length > 0 && (
        <FieldRenderer field="brand" value={form.brand} options={categoryBrands} />
      )}
      {categoryModels.length > 0 && (
        <FieldRenderer field="model" value={form.model} options={categoryModels} />
      )}

      {visibleFields.map(field => {
        if (field === "used_detail" && form.condition !== "Used") return null;
        
        return (
          <FieldRenderer
            key={field}
            field={field}
            value={form[field]}
            options={field === "features" ? categoryFeatures : getFieldOptions(field)}
          />
        );
      })}

      <FieldRenderer field="state" value={form.state} options={[]} />
      <FieldRenderer field="city" value={form.city} options={[]} />
    </section>
  );
}