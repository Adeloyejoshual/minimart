// src/components/AddProduct/DeliveryContactSection.jsx
// v22 - GLOBAL PHONE + MODAL SUPPORT + NO NIGERIAN RESTRICTIONS

import React from "react";

export default function DeliveryContactSection({
  form,
  deliveryForm,
  onFieldChange,
  onDeliveryChange,
  openSelectionModal,  // 🔥 NEW: Modal support
  locationsByState,    // 🔥 NEW: For state/city modals
  errors,
  touched
}) {
  const showDeliveryFee = ["delivery", "both"].includes(deliveryForm.method);
  
  // 🔥 REMOVED: All Nigerian phone validation - now global
  // Just check for reasonable length (7-15 digits)

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent border-b pb-4">
        🚚 Delivery & Contact
      </h2>

      {/* 🔥 STATE & CITY - NOW WITH MODAL SUPPORT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            State *
          </label>
          <div 
            id="field-state"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 hover:border-gray-400 group cursor-pointer select-none pr-10 bg-white relative transition-all focus:ring-4 focus:ring-orange-500 focus:border-orange-500"
            onClick={() => openSelectionModal('state', 
              Object.entries(locationsByState).map(([state]) => ({ 
                value: state, 
                label: state.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) 
              })), 
              form.state, 
              'Select State'
            )}
            tabIndex={0}
          >
            <span className="truncate block h-full py-2">
              {form.state ? form.state.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) : 'Click to select state'}
            </span>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-orange-500 transition-all pointer-events-none">
              ▼
            </div>
          </div>
          {touched?.state && errors?.state && (
            <p className="text-sm text-red-600" role="alert">{errors.state}</p>
          )}
        </div>

        <div className="form-group space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            City *
          </label>
          <div 
            id="field-city"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 hover:border-gray-400 group cursor-pointer select-none pr-10 bg-white relative transition-all focus:ring-4 focus:ring-orange-500 focus:border-orange-500"
            onClick={() => openSelectionModal('city', 
              locationsByState[form.state]?.map(city => ({ 
                value: city, 
                label: city.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) 
              })) || [], 
              form.city, 
              'Select City'
            )}
            tabIndex={0}
          >
            <span className="truncate block h-full py-2">
              {form.city ? form.city.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase()) : 'Click to select city'}
            </span>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-orange-500 transition-all pointer-events-none">
              ▼
            </div>
          </div>
          {touched?.city && errors?.city && (
            <p className="text-sm text-red-600" role="alert">{errors.city}</p>
          )}
        </div>
      </div>

      {/* 🔥 PHONE - GLOBAL VALIDATION ONLY (NO NIGERIAN RULES) */}
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
              : 'border-gray-300 hover:border-gray-400'
          }`}
          placeholder="Enter phone number (+1234567890 or 08012345678)"
        />
        {touched?.phone_number && errors?.phone_number && (
          <p className="text-sm text-red-600" role="alert">{errors.phone_number}</p>
        )}
        {/* 🔥 REMOVED: Nigerian-specific warning - now global */}
      </div>

      {/* DELIVERY METHOD - MODAL STYLE */}
      <div className="form-group space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Delivery Method
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { value: 'pickup', label: '🏠 Pickup Only', desc: 'Local pickup' },
            { value: 'delivery', label: '🚚 Delivery Only', desc: 'Ship anywhere' },
            { value: 'both', label: '📦 Pickup & Delivery', desc: 'Customer choice' }
          ].map(option => (
            <label
              key={option.value}
              className={`flex flex-col p-4 border-2 rounded-xl cursor-pointer hover:shadow-lg transition-all group ${
                deliveryForm.method === option.value
                  ? 'border-orange-500 bg-orange-50 shadow-lg ring-2 ring-orange-200'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <input
                type="radio"
                name="delivery_method"
                value={option.value}
                checked={deliveryForm.method === option.value}
                onChange={() => onDeliveryChange({ method: option.value })}
                className="sr-only"
              />
              <span className="font-semibold text-lg group-hover:text-orange-600">{option.label}</span>
              <span className="text-sm text-gray-600">{option.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* DELIVERY FEE */}
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
            onChange={(e) => onDeliveryChange({ fee: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 hover:border-gray-400 rounded-xl focus:ring-4 focus:ring-orange-500 focus:border-orange-500"
            placeholder="500 - 5000"
          />
          <p className="text-xs text-gray-500">Enter flat delivery fee (0 for free)</p>
          {touched?.delivery_fee && errors?.delivery_fee && (
            <p className="text-sm text-red-600">{errors.delivery_fee}</p>
          )}
        </div>
      )}

      {/* WHATSAPP */}
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