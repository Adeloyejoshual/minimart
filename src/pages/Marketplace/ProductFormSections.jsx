// ProductFormSections.jsx - COMPLETE PRODUCTION FORM
// All dynamic fields + validation + custom selects

import React from 'react';
import CustomSelect from './CustomSelect';
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules"; 
import { conditions } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";


export default function ProductFormSections({ 
  form, 
  images, 
  validationErrors, 
  computedFields, 
  cities, 
  years, 
  updateFormField, 
  handleImageUpload, 
  removeImage, 
  fileInputRef, 
  uploadingImages,
  toggleFeature,
  toggleSim 
}) {
  return (
    <>
      {/* 1. Basic Information */}
      <section className="form-section">
        <h2>Basic Information</h2>
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Product Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateFormField('title', e.target.value)}
              placeholder="iPhone 15 Pro Max 256GB - Perfect condition, warranty to 2026"
              maxLength={100}
              className={validationErrors.title ? 'error' : ''}
            />
            {validationErrors.title && <span className="error-text">{validationErrors.title}</span>}
            <small>{form.title.length}/100 (min 25)</small>
          </div>

          <div className="form-group full-width">
            <label>Description *</label>
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              placeholder="Detailed description: condition, usage history, reason for selling, what's included..."
              maxLength={1000}
              className={validationErrors.description ? 'error' : ''}
            />
            {validationErrors.description && <span className="error-text">{validationErrors.description}</span>}
            <small>{form.description.length}/1000 (min 50)</small>
          </div>

          <div className="form-group">
            <label>Category *</label>
            <CustomSelect
              value={form.category}
              onChange={value => updateFormField('category', value)}
              options={Object.keys(categoryFields).map(cat => ({ value: cat, label: cat }))}
              placeholder="📱 Choose category"
              error={validationErrors.category}
            />
          </div>

          {computedFields.availableBrands?.length > 0 && (
            <div className="form-group">
              <label>Brand</label>
              <CustomSelect
                value={form.brand}
                onChange={value => updateFormField('brand', value)}
                options={computedFields.availableBrands.map(b => ({ value: b, label: b }))}
                placeholder="Choose brand"
              />
            </div>
          )}

          {computedFields.availableModels?.length > 0 && (
            <div className="form-group">
              <label>Model</label>
              <CustomSelect
                value={form.model}
                onChange={value => updateFormField('model', value)}
                options={computedFields.availableModels.map(m => ({ value: m, label: m }))}
                placeholder="Choose model"
              />
            </div>
          )}
        </div>
      </section>

      {/* 2. Specifications - Dynamic by categoryFields */}
      {form.category && computedFields.showCategoryFields?.length > 0 && (
        <section className="form-section">
          <h2>Specifications</h2>
          <div className="form-grid">
            {/* Condition */}
            {computedFields.showCategoryFields.includes('condition') && (
              <div className="form-group">
                <label>Condition</label>
                <CustomSelect
                  value={form.condition}
                  onChange={value => updateFormField('condition', value)}
                  options={conditions.map(c => ({ value: c, label: c }))}
                  placeholder="New/Used/Refurbished"
                  error={validationErrors.condition}
                />
              </div>
            )}

            {/* RAM */}
            {computedFields.showCategoryFields.includes('ram') && (
              <div className="form-group">
                <label>RAM</label>
                <CustomSelect
                  value={form.ram}
                  onChange={value => updateFormField('ram', value)}
                  options={ramOptions.map(r => ({ value: r, label: r }))}
                  placeholder="4GB/8GB/12GB"
                  error={validationErrors.ram}
                />
              </div>
            )}

            {/* Storage */}
            {computedFields.showCategoryFields.includes('storage') && (
              <div className="form-group">
                <label>Storage</label>
                <CustomSelect
                  value={form.storage}
                  onChange={value => updateFormField('storage', value)}
                  options={storageOptions.map(s => ({ value: s, label: s }))}
                  placeholder="64GB/128GB/256GB"
                  error={validationErrors.storage}
                />
              </div>
            )}

            {/* Color */}
            {computedFields.showCategoryFields.includes('color') && (
              <div className="form-group">
                <label>Color</label>
                <CustomSelect
                  value={form.color}
                  onChange={value => updateFormField('color', value)}
                  options={colors.map(c => ({ value: c, label: c }))}
                  placeholder="Choose color"
                  error={validationErrors.color}
                />
              </div>
            )}

            {/* Year */}
            {computedFields.showCategoryFields.includes('year') && (
              <div className="form-group">
                <label>Year</label>
                <CustomSelect
                  value={form.year}
                  onChange={value => updateFormField('year', value)}
                  options={years.map(y => ({ value: y, label: y }))}
                  placeholder="2020/2021/2022"
                  error={validationErrors.year}
                />
              </div>
            )}

            {/* Engine */}
            {computedFields.showCategoryFields.includes('engine') && (
              <div className="form-group">
                <label>Engine</label>
                <CustomSelect
                  value={form.engine}
                  onChange={value => updateFormField('engine', value)}
                  options={engines.map(e => ({ value: e, label: e }))}
                  placeholder="1.5L/2.0L/2.5L"
                  error={validationErrors.engine}
                />
              </div>
            )}

            {/* Fuel Type */}
            {computedFields.showCategoryFields.includes('fuel_type') && (
              <div className="form-group">
                <label>Fuel Type</label>
                <CustomSelect
                  value={form.fuel_type}
                  onChange={value => updateFormField('fuel_type', value)}
                  options={fuelTypes.map(f => ({ value: f, label: f }))}
                  placeholder="Petrol/Diesel/Electric"
                  error={validationErrors.fuel_type}
                />
              </div>
            )}

            {/* Transmission */}
            {computedFields.showCategoryFields.includes('transmission') && (
              <div className="form-group">
                <label>Transmission</label>
                <CustomSelect
                  value={form.transmission}
                  onChange={value => updateFormField('transmission', value)}
                  options={[
                    { value: 'Manual', label: 'Manual' },
                    { value: 'Automatic', label: 'Automatic' },
                    { value: 'CVT', label: 'CVT' },
                    { value: 'AMT', label: 'AMT' }
                  ]}
                  placeholder="Manual/Automatic"
                  error={validationErrors.transmission}
                />
              </div>
            )}

            {/* Mileage */}
            {computedFields.showCategoryFields.includes('mileage') && (
              <div className="form-group">
                <label>Mileage (km)</label>
                <input
                  type="number"
                  value={form.mileage}
                  onChange={e => updateFormField('mileage', e.target.value)}
                  placeholder="50000"
                  className={validationErrors.mileage ? 'error' : ''}
                />
                {validationErrors.mileage && <span className="error-text">{validationErrors.mileage}</span>}
              </div>
            )}

            {/* SIM Multi-select */}
            {computedFields.showCategoryFields.includes('sim') && (
              <div className="form-group full-width">
                <label>SIM Type</label>
                <div className="checkbox-grid">
                  {['Single SIM', 'Dual SIM', 'eSIM', 'eSIM + Physical'].map(simType => (
                    <label key={simType} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.sim.includes(simType)}
                        onChange={() => toggleSim(simType)}
                      />
                      {simType}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Features Multi-select */}
            {computedFields.showCategoryFields.includes('features') && computedFields.categoryFeatures?.length > 0 && (
              <div className="form-group full-width">
                <label>Features</label>
                <div className="checkbox-grid-2">
                  {computedFields.categoryFeatures.slice(0, 12).map(feature => (
                    <label key={feature} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.features.includes(feature)}
                        onChange={() => toggleFeature(feature)}
                      />
                      {feature}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Pricing */}
      <section className="form-section">
        <h2>Pricing</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Price (₦) *</label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                updateFormField('rawPrice', rawValue);
              }}
              placeholder="150000"
              className={validationErrors.price ? 'error' : ''}
            />
            {validationErrors.price && <span className="error-text">{validationErrors.price}</span>}
          </div>

          <div className="form-group">
            <label>Discount Price</label>
            <input
              type="text"
              value={form.discount_price}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                updateFormField('rawDiscountPrice', rawValue);
              }}
              placeholder="135000"
            />
          </div>

          <div className="form-group checkbox-row">
            <label className="checkbox-label full-width">
              <input
                type="checkbox"
                checked={form.negotiable}
                onChange={e => updateFormField('negotiable', e.target.checked)}
              />
              Price Negotiable
            </label>
            <label className="checkbox-label full-width">
              <input
                type="checkbox"
                checked={form.flash_sale}
                onChange={e => updateFormField('flash_sale', e.target.checked)}
              />
              Flash Sale
            </label>
          </div>
        </div>
      </section>

      {/* 4. Images */}
      <section className="form-section">
        <h2>Images *</h2>
        {validationErrors.images && <span className="error-text">{validationErrors.images}</span>}
        <div className="image-upload-area" onClick={() => !uploadingImages && fileInputRef.current?.click()}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImages || images.files.length >= 10}
            className="hidden"
          />
          <div className="upload-placeholder">
            <span className="upload-icon">📷</span>
            <p>{uploadingImages ? 'Uploading...' : 'Click to upload (max 10)'}</p>
            <small>{images.files.length}/10 • Max 5MB each</small>
          </div>
        </div>
        {images.previews.length > 0 && (
          <div className="image-previews">
            {images.previews.map((preview, index) => (
              <div key={index} className="image-preview">
                <img src={preview} alt={`Preview ${index}`} />
                <button className="remove-image" onClick={() => removeImage(index)} disabled={uploadingImages}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Promotion */}
      <section className="form-section">
        <h2>Promotion</h2>
        <div className="form-grid">
          <div className="form-group full-width">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.promoted}
                onChange={e => {
                  updateFormField('promoted', e.target.checked);
                  if (!e.target.checked) updateFormField('promo_plan', '');
                }}
              />
              <span>Boost listing <small>(Paystack • Published listings only)</small></span>
            </label>
          </div>
          {form.promoted && promotionPlans.length > 0 && (
            <div className="form-group">
              <label>Plan</label>
              <CustomSelect
                value={form.promo_plan}
                onChange={value => updateFormField('promo_plan', value)}
                options={promotionPlans.map(p => ({ 
                  value: p.name, 
                  label: `${p.name} (₦${p.price}/month)` 
                }))}
                placeholder="Choose promotion plan"
              />
            </div>
          )}
        </div>
      </section>

      {/* 6. Contact */}
      <section className="form-section">
        <h2>Contact Information</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={e => updateFormField('phone_number', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="08012345678"
              maxLength={11}
              className={validationErrors.phone ? 'error' : ''}
            />
            {validationErrors.phone && <span className="error-text">{validationErrors.phone}</span>}
          </div>

          <div className="form-group">
            <label>State</label>
            <CustomSelect
              value={form.state}
              onChange={value => updateFormField('state', value)}
              options={Object.keys(locationsByState).map(s => ({ value: s, label: s }))}
              placeholder="Lagos/Abuja"
            />
          </div>

          {cities.length > 0 && (
            <div className="form-group">
              <label>City</label>
              <CustomSelect
                value={form.city}
                onChange={value => updateFormField('city', value)}
                options={cities.map(c => ({ value: c, label: c }))}
                placeholder="Ikeja/Lekki"
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}