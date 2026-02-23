// src/components/AddProduct/DeliveryContactSection.jsx
// v21 FINAL - ALL BUGS FIXED, CONTRACT PERFECT

import React from "react";

export default function DeliveryContactSection({
  form,
  deliveryForm,
  onFieldChange,
  onDeliveryChange,
  errors,
  touched
}) {
  const showDeliveryFee = ["delivery", "both"].includes(deliveryForm.method);
  
  // ✅ FIXED PHONE REGEX - Nigerian mobile numbers
  const normalizedPhone = form.phone_number?.replace(/\D/g, '');

const isValidPhone =
  normalizedPhone &&
  /^(?:234|0)?[789]\d{9}$/.test(normalizedPhone);

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent border-b pb-4">
        🚚 Delivery & Contact
      </h2>

      {/* LOCATION - PARENT FIELDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group space-y-2">
          <label htmlFor="field-state" className="block text-sm font-medium text-gray-700">
            State *
          </label>
          <input
            id="field-state"
            type="text"
            value={form.state || ""}
            onChange={(e) => onFieldChange("state", e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-orange-500 focus:border-orange-500 ${
              touched?.state && errors?.state ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
            }`}
            placeholder="Lagos"
          />
          {touched?.state && errors?.state && (
            <p className="text-sm text-red-600" role="alert">{errors.state}</p>
          )}
        </div>

        <div className="form-group space-y-2">
          <label htmlFor="field-city" className="block text-sm font-medium text-gray-700">
            City *
          </label>
          <input
            id="field-city"
            type="text"
            value={form.city || ""}
            onChange={(e) => onFieldChange("city", e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-orange-500 focus:border-orange-500 ${
              touched?.city && errors?.city ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
            }`}
            placeholder="Ikeja"
          />
          {touched?.city && errors?.city && (
            <p className="text-sm text-red-600" role="alert">{errors.city}</p>
          )}
        </div>
      </div>

      {/* PHONE - ✅ FIXED REGEX + TOUCHED CHECK */}
      <div className="form-group space-y-2">
        <label htmlFor="field-phone_number" className="block text-sm font-medium text-gray-700">
          Phone Number *
        </label>
        <input
          id="field-phone_number"
          type="tel"
          value={form.phone_number || ""}
          onChange={(e) => onFieldChange("phone_number", e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-green-500 focus:border-green-500 ${
            touched?.phone_number && errors?.phone_number
              ? 'border-red-500 ring-2 ring-red-200'
              : touched?.phone_number && form.phone_number && !isValidPhone
              ? 'border-orange-500 ring-2 ring-orange-200'
              : form.phone_number && isValidPhone
              ? 'border-green-300 ring-1 ring-green-200'
              : 'border-gray-300'
          }`}
          placeholder="08012345678 or +2348012345678"
        />
        {touched?.phone_number && errors?.phone_number && (
          <p className="text-sm text-red-600" role="alert">{errors.phone_number}</p>
        )}
        {touched?.phone_number && form.phone_number && !isValidPhone && (
          <p className="text-sm text-orange-600">Enter valid Nigerian number (080, 070, 090, 234)</p>
        )}
      </div>

      {/* DELIVERY - ✅ FIXED onDeliveryChange OBJECT FORMAT */}
      <div className="form-group space-y-2">
        <label htmlFor="field-delivery_method" className="block text-sm font-medium text-gray-700">
          Delivery Method
        </label>
        <select
          id="field-delivery_method"
          value={deliveryForm.method || ""}
          onChange={(e) => onDeliveryChange({ method: e.target.value })}  // ✅ FIXED: Object format
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="">Select delivery method</option>
          <option value="pickup">🏠 Pickup Only</option>
          <option value="delivery">🚚 Delivery Only</option>
          <option value="both">📦 Pickup & Delivery</option>
        </select>
      </div>

      {/* DELIVERY FEE - ✅ FIXED onDeliveryChange OBJECT FORMAT */}
      {showDeliveryFee && (
        <div className="form-group space-y-2">
          <label htmlFor="field-delivery_fee" className="block text-sm font-medium text-gray-700">
            Delivery Fee (₦)
          </label>
          <input
            id="field-delivery_fee"
            type="number"
            min="0"
            step="100"
            value={deliveryForm.fee || ""}
            onChange={(e) => onDeliveryChange({ fee: e.target.value })}  // ✅ FIXED: Object format
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-orange-500 focus:border-orange-500"
            placeholder="500 - 5000"
          />
          <p className="text-xs text-gray-500">Enter flat delivery fee (0 for free)</p>
        </div>
      )}

      {/* WHATSAPP - Safe fallback */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-center space-x-3 p-4 border border-emerald-200 rounded-xl hover:border-emerald-300 bg-emerald-50 cursor-pointer group transition-all">
          <input
            id="field-whatsapp_available"
            type="checkbox"
            checked={form.whatsapp_available || false}
            onChange={(e) => onFieldChange("whatsapp_available", e.target.checked)}
            className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <div>
            <span className="block font-semibold text-gray-900 group-hover:text-emerald-600">💬 WhatsApp Available</span>
            <span className="text-sm text-gray-600">Buyers can contact via WhatsApp</span>
          </div>
        </label>
      </div>

      {/* SUMMARY */}
      {(form.state || form.city) && deliveryForm.method && (
        <div className="p-6 bg-gradient-to-r from-orange-50 to-emerald-50 rounded-2xl border border-orange-200">
          <h4 className="font-semibold text-gray-900 mb-3">📋 Delivery Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm">
              <span className="w-10 text-orange-600">📍</span>
              <span>{form.state}, {form.city}</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm">
              <span className="w-10 text-green-600">📱</span>
              <span>{form.phone_number || 'Not set'}</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm">
              <span className="w-10 text-orange-600">🚚</span>
              <span>
                {deliveryForm.method === 'pickup' ? 'Pickup' : 
                 deliveryForm.method === 'delivery' ? 'Delivery' : 'Both'}
                {showDeliveryFee && deliveryForm.fee ? ` (₦${deliveryForm.fee})` : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}