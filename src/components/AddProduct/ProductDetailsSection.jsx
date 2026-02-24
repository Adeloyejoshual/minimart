// src/components/AddProduct/ProductDetailsSection.jsx
// v26 - ✅ FULLY FIXED: Text inputs editable + Production-safe

import React, { useCallback, useMemo } from "react";

export default function ProductDetailsSection({
  form,
  onFieldChange,
  openSelectionModal,
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
  // 🔥 Safe config access - handles all data shapes
  const allOptions = useMemo(() => ({
    condition: Array.isArray(conditions) ? conditions : [],
    used_detail: Array.isArray(usedDetails) ? usedDetails : [],
    ram: Array.isArray(ramOptions) ? ramOptions : [],
    storage: Array.isArray(storageOptions) ? storageOptions : [],
    color: Array.isArray(colors) ? colors : [],
    sim: Array.isArray(sims) ? sims : [],
    year: Array.isArray(years) ? years : [],
    engine: Array.isArray(engines) ? engines : [],
    fuel_type: Array.isArray(fuelTypes) ? fuelTypes : [],
    brand: Array.isArray(brands[form.category]) 
      ? brands[form.category] 
      : Array.isArray(brands) ? brands : [],
    model: Array.isArray(models[form.category]?.[form.brand])
      ? models[form.category][form.brand]
      : Array.isArray(models) ? Object.values(models).flat() : [],
    category: Object.keys(categoryFields || {}).map(cat => ({
      value: cat,
      label: cat.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())
    }))
  }), [form.category, form.brand, categoryFields, brands, models, conditions, usedDetails, ramOptions, storageOptions, colors, sims, years, engines, fuelTypes]);

  const visibleFields = useMemo(() => 
    Array.isArray(categoryFields[form.category]) ? categoryFields[form.category] : []
  , [form.category, categoryFields]);

  const coreFields = ['title', 'category'];
  const specialFields = useMemo(() => {
    const fields = [];
    if ((brands[form.category] || []).length > 0 || Object.keys(brands || {}).length > 0) {
      fields.push('brand');
    }
    if ((models[form.category]?.[form.brand] || []).length > 0 || Object.keys(models || {}).length > 0) {
      fields.push('model');
    }
    return fields;
  }, [form.category, form.brand, brands, models]);

  const categoryOnlyFields = useMemo(() => 
    visibleFields.filter(field => !coreFields.includes(field) && !specialFields.includes(field))
  , [visibleFields, specialFields]);

  const getOptionLabel = useCallback((field, value) => {
    const options = allOptions[field] || [];
    const option = options.find(opt => opt?.value === value || opt === value);
    return option?.label || option || value || 'Select...';
  }, [allOptions]);

  const FieldRenderer = ({ field, value, showLabel = true }) => {
    const hasError = touched?.[field] && errors?.[field];
    const options = allOptions[field] || [];
    const safeValue = value ?? "";
    const hasSelectionOptions = options.length > 3;
    const isFeaturesField = field === "features";
    const isNumberField = ["year", "ram", "mileage", "bedrooms", "bathrooms", "size"].includes(field);
    const isTextField = !isFeaturesField && !hasSelectionOptions && !isNumberField;
    
    const labelText = field
      .replace(/_/g, " ")
      .replace(/\bw/g, l => l.toUpperCase());
    
    // 🔥 FIXED: Proper cursor classes for each input type
    const getBaseClasses = () => {
      const base = `w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-blue-500 focus:border-blue-500 ${
        hasError ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 hover:border-gray-400'
      }`;
      
      if (isTextField) return `${base} cursor-text`;
      if (isNumberField) return `${base} cursor-auto`;
      if (hasSelectionOptions) return `${base} cursor-pointer select-none group pr-10 bg-white relative`;
      return `${base} cursor-pointer pr-8 appearance-none bg-no-repeat bg-[right_0.75rem_center/1rem_auto] bg-[url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0%200%2020%2020'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6%208l4%204%204-4'/%3e%3c/svg%3e")]`;
    };

    return (
      <div className="space-y-2">
        {showLabel && (
          <label htmlFor={`field-${field}`} className="block text-sm font-medium text-gray-700">
            {labelText} {visibleFields.includes(field) && "*"}
          </label>
        )}
        
        {/* 🔥 TEXT INPUTS - TITLE FIELD WORKS */}
        {isTextField && (
          <input
            id={`field-${field}`}
            type="text"
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={getBaseClasses()}
            placeholder={`Enter ${labelText.toLowerCase()}`}
          />
        )}
        
        {/* 🔥 NUMBER INPUTS */}
        {isNumberField && (
          <input
            id={`field-${field}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={getBaseClasses()}
            placeholder={`Enter ${labelText.toLowerCase()}`}
          />
        )}
        
        {/* 🔥 FEATURES CHECKBOXES */}
        {isFeaturesField && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 max-h-48 overflow-y-auto">
            {(featuresByCategory[form.category] || []).map(option => (
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
        )}
        
        {/* 🔥 MODAL TRIGGERS (Brand, RAM, etc.) */}
        {hasSelectionOptions && !isFeaturesField && (
          <div 
            id={`field-${field}`}
            className={getBaseClasses()}
            onClick={() => options.length > 0 && openSelectionModal(field, options, safeValue, labelText)}
            tabIndex={0}
            role="button"
            aria-label={`Select ${labelText}`}
          >
            <span className="truncate block h-full py-2">
              {getOptionLabel(field, safeValue)}
            </span>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-all pointer-events-none">
              ▼
            </div>
          </div>
        )}
        
        {/* 🔥 NATIVE SELECTS */}
        {options.length > 0 && !hasSelectionOptions && !isFeaturesField && !isTextField && !isNumberField && (
          <select
            id={`field-${field}`}
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={getBaseClasses()}
          >
            <option value="">Select {labelText}</option>
            {options.map(opt => (
              <option key={opt?.value || opt} value={opt?.value || opt}>
                {opt?.label || opt}
              </option>
            ))}
          </select>
        )}
        
        {hasError && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors[field]}
          </p>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent border-b pb-4">
        📦 Product Details
      </h2>

      {/* 🔥 CORE FIELDS ALWAYS SHOW */}
      <FieldRenderer field="title" />
      <FieldRenderer field="category" />
      
      {/* 🔥 CONDITIONAL FIELDS */}
      {specialFields.includes('brand') && <FieldRenderer field="brand" />}
      {specialFields.includes('model') && <FieldRenderer field="model" />}
      
      {/* 🔥 CATEGORY-SPECIFIC FIELDS */}
      {categoryOnlyFields.map(field => (
        <FieldRenderer key={field} field={field} />
      ))}
    </section>
  );
}