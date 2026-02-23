// src/components/AddProduct/PricingBoostSection.jsx
// v21 FINAL OPTIMIZED - PERFECT PARENT SYNC

import React from "react";

export default function PricingBoostSection({
  form,
  onFieldChange,
  promotionPlans,
  cleanPrice,
  cleanDiscountPrice,
  errors,
  touched
}) {
  // ✅ PERFECT MATCH - Same as parent
  const extractDigits = (value) => value.replace(/\D/g, '');

  const formatCurrency = (value) => {
    const num = Number(extractDigits(value));
    return num ? new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(num) : '';
  };

  // ✅ PERFECT SYNC - Parent clean values
  const isDiscountValid = cleanDiscountPrice > 0 && cleanDiscountPrice < cleanPrice;
  const savePercent = cleanPrice > 0 && cleanDiscountPrice > 0 
    ? Math.round((1 - cleanDiscountPrice / cleanPrice) * 100)
    : 0;

  // ✅ OPTIMIZATION - Single lookup
  const selectedPlan = promotionPlans?.find(
    p => (p.id || p.name) === form.promo_plan
  );

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent border-b pb-4">
        💰 Pricing & Boost
      </h2>

      {/* PRICE */}
      <div className="form-group space-y-2">
        <label htmlFor="field-price" className="block text-sm font-medium text-gray-700">
          Price *
        </label>
        <input
          id="field-price"
          type="text"
          value={formatCurrency(form.price)}
          onChange={(e) => onFieldChange("price", e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-emerald-500 focus:border-emerald-500 ${
            touched?.price && errors?.price 
              ? 'border-red-500 ring-2 ring-red-200' 
              : 'border-gray-300'
          }`}
          placeholder="₦ 50,000"
        />
        {touched?.price && errors?.price && (
          <p className="text-sm text-red-600" role="alert">{errors.price}</p>
        )}
        {cleanPrice > 0 && (
          <p className="text-sm text-emerald-600 font-medium">
            {formatCurrency(cleanPrice.toString())}
          </p>
        )}
      </div>

      {/* DISCOUNT PRICE */}
      <div className="form-group space-y-2">
        <label htmlFor="field-discount_price" className="block text-sm font-medium text-gray-700">
          Discount Price (Optional)
        </label>
        <input
          id="field-discount_price"
          type="text"
          value={formatCurrency(form.discount_price)}
          onChange={(e) => onFieldChange("discount_price", e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-emerald-500 focus:border-emerald-500 ${
            touched?.discount_price && errors?.discount_price
              ? 'border-red-500 ring-2 ring-red-200'
              : !isDiscountValid && cleanDiscountPrice > 0
              ? 'border-orange-500 ring-2 ring-orange-200'
              : 'border-gray-300'
          }`}
          placeholder="₦ 45,000 (must be less than price)"
        />
        {touched?.discount_price && errors?.discount_price && (
          <p className="text-sm text-red-600" role="alert">{errors.discount_price}</p>
        )}
      </div>

      {/* PRICING SUMMARY */}
      {cleanPrice > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-6 rounded-2xl border border-emerald-200">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold text-gray-800">Regular Price:</span>
            <span className="font-bold text-2xl text-emerald-700">
              {formatCurrency(cleanPrice.toString())}
            </span>
          </div>
          {cleanDiscountPrice > 0 && (
            <div className="mt-4 p-4 bg-white/60 rounded-xl border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-800">Discount Price:</span>
                <span className={`font-bold text-xl ${
                  isDiscountValid ? 'text-blue-700' : 'text-orange-600'
                }`}>
                  {formatCurrency(cleanDiscountPrice.toString())}
                </span>
              </div>
              {isDiscountValid ? (
                <div className="flex justify-between items-center text-emerald-600 font-bold bg-emerald-100 px-4 py-2 rounded-lg">
                  <span>✅ Valid Discount</span>
                  <span>{savePercent}% OFF</span>
                </div>
              ) : (
                <p className="text-sm text-orange-600 mt-2">
                  ⚠️ Discount must be less than regular price
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* BOOST TOGGLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:border-gray-300 cursor-pointer group transition-all">
          <input
            id="field-negotiable"
            type="checkbox"
            checked={form.negotiable}
            onChange={(e) => onFieldChange("negotiable", e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <span className="block font-semibold text-gray-900 group-hover:text-blue-600">💬 Negotiable</span>
            <span className="text-xs text-gray-500">Buyers can message to negotiate</span>
          </div>
        </label>

        <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-xl hover:border-gray-300 cursor-pointer group transition-all">
          <input
            id="field-flash_sale"
            type="checkbox"
            checked={form.flash_sale}
            onChange={(e) => onFieldChange("flash_sale", e.target.checked)}
            className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
          />
          <div>
            <span className="block font-semibold text-gray-900 group-hover:text-orange-600">⚡ Flash Sale</span>
            <span className="text-xs text-gray-500">Highlight as limited time offer</span>
          </div>
        </label>
      </div>

      {/* PROMOTION */}
      <div className="pt-6 border-t border-gray-200">
        <label className="flex items-center space-x-3 p-4 border border-purple-200 rounded-xl hover:border-purple-300 bg-purple-50 cursor-pointer group transition-all">
          <input
            id="field-promoted"
            type="checkbox"
            checked={form.promoted}
            onChange={(e) => onFieldChange("promoted", e.target.checked)}
            className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <div>
            <span className="block font-bold text-xl text-purple-900 group-hover:text-purple-700">🚀 Boost Listing</span>
            <span className="text-sm text-purple-700">Get more views and inquiries</span>
          </div>
        </label>

        {form.promoted && promotionPlans?.length > 0 && (
          <div className="mt-6 space-y-3 pl-2">
            <select
              id="field-promo_plan"
              value={form.promo_plan}
              onChange={(e) => onFieldChange("promo_plan", e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Choose your boost plan</option>
              {promotionPlans.map((plan) => (
                <option key={plan.id || plan.name} value={plan.id || plan.name}>
                  {plan.name} — ₦{plan.price} ({plan.duration})
                </option>
              ))}
            </select>

            {selectedPlan && (  // ✅ SINGLE LOOKUP OPTIMIZATION
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-purple-900">
                    {selectedPlan.name}
                  </span>
                  <span className="font-bold text-lg text-purple-700">
                    ₦{selectedPlan.price}
                  </span>
                </div>
                <p className="text-xs text-purple-600 mt-1">{selectedPlan.duration}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}