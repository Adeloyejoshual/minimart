// src/components/AddProduct/ProductDetailsSection.jsx
// v25 - ✅ FIXED: Works with flat config arrays

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
  // 🔥 FIXED: Works with your FLAT config arrays
  const allOptions = useMemo(() => ({
    condition: conditions,
    used_detail: usedDetails,
    ram: ramOptions,           // ✅ Flat array works
    storage: storageOptions,   // ✅ Flat array works
    color: colors,             // ✅ Flat array works
    sim: sims,                 // ✅ Flat array works
    year: years,
    engine: engines,
    fuel_type: fuelTypes,
    brand: brands[form.category] || Object.values(brands).flat() || [],
    model: models[form.category]?.[form.brand] || Object.values(models).flat().flat() || [],
    category: Object.keys(categoryFields).map(cat => ({
      value: cat,
      label: cat.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())
    }))
  }), [form.category, form.brand, categoryFields, brands, models, ramOptions, storageOptions, colors, sims, engines, fuelTypes, years]);

  const visibleFields = useMemo(() => categoryFields[form.category] || [], [form.category, categoryFields]);
  
  const coreFields = ['title', 'category'];
  const specialFields = useMemo(() => {
    const fields = [];
    if (brands[form.category]?.length > 0 || Object.keys(brands).length > 0) fields.push('brand');
    if (models[form.category]?.[form.brand]?.length > 0 || Object.keys(models).length > 0) fields.push('model');
    return fields;
  }, [form.category, form.brand, brands, models]);

  const categoryOnlyFields = useMemo(() => 
    visibleFields.filter(field => 
      !coreFields.includes(field) && !specialFields.includes(field)
    ), [visibleFields, specialFields]);

  const getOptionLabel = useCallback((field, value) => {
    const options = allOptions[field] || [];
    const option = options.find(opt => opt.value === value || opt === value);
    return option?.label || option || value || 'Select...';
  }, [allOptions]);

  const FieldRenderer = ({ field, value, showLabel = true }) => {
    const hasError = touched?.[field] && errors?.[field];
    const options = allOptions[field] || [];
    const safeValue = value ?? "";
    const hasSelectionOptions = options.length > 3;
    
    const labelText = field
      .replace(/_/g, " ")
      .replace(/\bw/g, l => l.toUpperCase());
    
    const baseClass = `w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-blue-500 focus:border-blue-500 group cursor-pointer select-none ${
      hasError ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 hover:border-gray-400'
    }`;

    return (
      <div className="form-group space-y-2">
        {showLabel && (
          <label htmlFor={`field-${field}`} className="block text-sm font-medium text-gray-700">
            {labelText} {visibleFields.includes(field) && "*"}
          </label>
        )}
        
        {/* 🔥 SPECIAL CASES */}
        {field === "features" ? (
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
        ) : ["year", "ram", "mileage", "bedrooms", "bathrooms", "size"].includes(field) ? (
          <input
            id={`field-${field}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={`${baseClass.replace('cursor-pointer select-none', 'cursor-auto')} pr-4`}
            placeholder={`Enter ${labelText.toLowerCase()}`}
          />
        ) : hasSelectionOptions ? (
          <div 
            id={`field-${field}`}
            className={`${baseClass} pr-10 bg-white relative`}
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
        ) : options.length > 0 ? (
          <select
            id={`field-${field}`}
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={`${baseClass} pr-8 cursor-pointer appearance-none bg-no-repeat bg-[right_0.75rem_center/1rem_auto] bg-[url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0%200%2020%2020'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6%208l4%204%204-4'/%3e%3c/svg%3e")]`}
          >
            <option value="">Select {labelText}</option>
            {options.map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`field-${field}`}
            type="text"
            value={safeValue}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className={baseClass.replace('cursor-pointer select-none', 'cursor-text')}
            placeholder={`Enter ${labelText.toLowerCase()}`}
          />
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

      <FieldRenderer field="title" />
      <FieldRenderer field="category" />
      {specialFields.includes('brand') && <FieldRenderer field="brand" />}
      {specialFields.includes('model') && <FieldRenderer field="model" />}
      
      {categoryOnlyFields.map(field => (
        <FieldRenderer key={field} field={field} />
      ))}
    </section>
  );
}