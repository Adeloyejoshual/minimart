import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules";
import { conditions, usedDetails } from "../../config/conditions";
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

const initializeForm = (user) => ({  
  title: "", description: "", price: "", discount_price: "", category: "", subcategory: "", brand: "", model: "",  
  condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "",  
  year: "", fuel_type: "", transmission: "", phone_number: user?.phone_number || "", additional_phone: "",  
  poster_name: user?.name || "", state: "", city: "", social_link: "", images: [], video_link: "", promoted: false,  
  promo_plan: "", flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: []  
});

function getFieldOptions(field, computed) {  
  const optionsMap = {  
    subcategory: computed.visibleFields,   
    brand: computed.availableBrands,   
    model: computed.availableModels,   
    condition: conditions,   
    ram: ramOptions,   
    storage: storageOptions,   
    color: colors,   
    engine: engines,   
    fuel_type: fuelTypes,   
    year: Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()),   
    transmission: ["Manual", "Automatic", "CVT"]  
  };  
  return optionsMap[field] || [];  
}

export default function AddMarketplaceProduct() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [deliveryForm, setDeliveryForm] = useState({ 
    state: "", city: "", method: "Courier", from: "", to: "", chargeFee: false, fee: "", 
    expressAvailable: false, warehouseAddress: "" 
  });
  const [cities, setCities] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Computed fields based on category/brand selections
  const computedFields = {
    visibleFields: form.category ? categoryFields[form.category]?.subcategories || [] : [],
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: featuresByCategory[form.category] || []
  };

  // Update cities when state changes
  useEffect(() => {
    if (form.state && locationsByState[form.state]) {
      setCities(locationsByState[form.state]);
    } else {
      setCities([]);
    }
  }, [form.state]);

  const updateFormField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleImageUpload = (e) => {
    const newFiles = Array.from(e.target.files);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    
    setImages(prev => ({
      files: [...prev.files, ...newFiles],
      previews: [...prev.previews, ...newPreviews]
    }));
    updateFormField('images', [...form.images, ...newFiles.map(f => f.name)]);
  };

  const removeImage = (index) => {
    setImages({
      files: images.files.filter((_, i) => i !== index),
      previews: images.previews.filter((_, i) => i !== index)
    });
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const toggleFeature = (feature) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const toggleDeliveryRegion = (region) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.includes(region)
        ? prev.deliveryRegions.filter(r => r !== region)
        : [...prev.deliveryRegions, region]
    }));
  };

  const handleSubmit = async (status = 'draft') => {
    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const formData = new FormData();
      
      // Append all form fields
      Object.keys(form).forEach(key => {
        if (key === 'images') return; // Handle separately
        if (Array.isArray(form[key])) {
          formData.append(key, JSON.stringify(form[key]));
        } else {
          formData.append(key, form[key]);
        }
      });

      // Append images
      images.files.forEach((file, index) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        alert(status === 'published' ? '✅ Product Published!' : '💾 Saved as Draft!');
        if (status === 'published' && form.promoted && form.promo_plan) {
          // Handle Paystack promotion payment
          window.location.href = `/promote/${response.productId}`;
        } else {
          window.location.href = '/dashboard';
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('❌ Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center">Please log in</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-black bg-clip-text text-transparent mb-6">
            Add New Product
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Complete all sections to list your product on the marketplace
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Main Form - 2/3 width */}
          <div className="lg:col-span-2 space-y-10">
            
            {/* SECTION 1: Basic Info */}
            <section className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-10">
              <h2 className="text-3xl font-black text-gray-900 mb-8">1. Basic Information</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Product Title *</label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 shadow-lg"
                    value={form.title}
                    onChange={(e) => updateFormField('title', e.target.value)}
                    placeholder="e.g. iPhone 15 Pro Max 256GB"
                  />
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Category *</label>
                  <select
                    className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20"
                    value={form.category}
                    onChange={(e) => updateFormField('category', e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {Object.keys(categoryFields).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Subcategory</label>
                  <select
                    className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20"
                    value={form.subcategory}
                    onChange={(e) => updateFormField('subcategory', e.target.value)}
                  >
                    <option value="">Select Subcategory</option>
                    {getFieldOptions('subcategory', computedFields).map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Brand</label>
                  <select
                    className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20"
                    value={form.brand}
                    onChange={(e) => updateFormField('brand', e.target.value)}
                  >
                    <option value="">Select Brand</option>
                    {getFieldOptions('brand', computedFields).map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Model</label>
                  <select
                    className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20"
                    value={form.model}
                    onChange={(e) => updateFormField('model', e.target.value)}
                  >
                    <option value="">Select Model</option>
                    {getFieldOptions('model', computedFields).map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* SECTION 2: Pricing */}
            <section className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-10">
              <h2 className="text-3xl font-black text-gray-900 mb-8">2. Pricing & Offers</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-4">Price (₦) *</label>
                  <input
                    type="number"
                    className="w-full px-6 py-4 text-2xl font-bold border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 shadow-lg"
                    value={form.price}
                    onChange={(e) => updateFormField('price', e.target.value)}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-4">Discount Price</label>
                    <input
                      type="number"
                      className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20"
                      value={form.discount_price}
                      onChange={(e) => updateFormField('discount_price', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed cursor-pointer hover:border-blue-400">
                      <input
                        type="checkbox"
                        className="w-5 h-5 mr-3"
                        checked={form.negotiable}
                        onChange={(e) => updateFormField('negotiable', e.target.checked)}
                      />
                      <span>Negotiable</span>
                    </label>
                    <label className="flex items-center p-4 bg-gray-50 rounded-2xl border-2 border-dashed cursor-pointer hover:border-purple-400">
                      <input
                        type="checkbox"
                        className="w-5 h-5 mr-3"
                        checked={form.flash_sale}
                        onChange={(e) => updateFormField('flash_sale', e.target.checked)}
                      />
                      <span>Flash Sale</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Images Section */}
            <section className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-10">
              <h2 className="text-3xl font-black text-gray-900 mb-8">Images</h2>
              <div className="space-y-6">
                <label
                  htmlFor="image-upload"
                  className="block w-full h-48 border-4 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
                >
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="mx-auto w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-6 text-white shadow-2xl">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">Click to upload images</p>
                  <p className="text-lg text-gray-600">Max 10 images, 10MB each</p>
                </label>
                
                {images.previews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.previews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img src={preview} className="w-full h-32 object-cover rounded-2xl" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Contact & Location */}
            <section className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-10">
              <h2 className="text-3xl font-black text-gray-900 mb-8">Contact & Location</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-3">Phone Number *</label>
                  <input
                    type="tel"
                    className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20"
                    value={form.phone_number}
                    onChange={(e) => updateFormField('phone_number', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-3">State *</label>
                  <select
                    className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20"
                    value={form.state}
                    onChange={(e) => updateFormField('state', e.target.value)}
                  >
                    <option value="">Select State</option>
                    {Object.keys(locationsByState).map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-3">City</label>
                  <select
                    className="w-full px-6 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20"
                    value={form.city}
                    onChange={(e) => updateFormField('city', e.target.value)}
                  >
                    <option value="">Select City</option>
                    {cities.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>
            </section>

          </div>

          {/* Right Sidebar - Publish Panel */}
          <div className="lg:sticky lg:top-8 space-y-8">
            <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 p-10">
              <h3 className="text-2xl font-black text-gray-900 mb-8">Publish Options</h3>
              
              {/* Checklist */}
              <div className="mb-10">
                <div className="space-y-4 mb-8">
                  <div className={`p-4 rounded-2xl border-2 ${form.title ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-bold ${form.title ? 'bg-emerald-500 text-white' : 'bg-gray-300'}`}>
                        {form.title ? '✓' : '○'}
                      </div>
                      <span className={form.title ? 'text-emerald-800 font-semibold' : 'text-gray-600'}>Product Title</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl border-2 ${form.phone_number ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-bold ${form.phone_number ? 'bg-emerald-500 text-white' : 'bg-gray-300'}`}>
                        {form.phone_number ? '✓' : '○'}
                      </div>
                      <span className={form.phone_number ? 'text-emerald-800 font-semibold' : 'text-gray-600'}>Phone Number</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <button
                  onClick={() => handleSubmit('draft')}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-black py-5 px-6 rounded-3xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all text-lg"
                >
                  💾 Save Draft
                </button>
                <button
                  onClick={() => handleSubmit('published')}
                  disabled={isSubmitting || !form.title || !form.phone_number}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-white font-black py-5 px-6 rounded-3xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all text-lg disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-r-white mr-3 inline-block"></div>
                      Publishing...
                    </>
                  ) : (
                    '🚀 Publish Product'
                  )}
                </button>
              </div>

              {/* Terms Checkbox */}
              <div className="mt-10 pt-8 border-t-2 border-gray-200">
                <label className="flex items-center space-x-4 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-3xl border-2 border-orange-200 cursor-pointer hover:border-orange-300 group transition-all">
                  <input
                    type="checkbox"
                    className="w-6 h-6 text-orange-600 rounded-xl focus:ring-orange-500 border-3 border-gray-300 group-hover:border-orange-400 transition-all"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <span className="text-base font-semibold text-gray-800">
                    I agree to the <span 
                      className="text-orange-600 font-bold underline cursor-pointer hover:text-orange-700 transition-colors"
                      onClick={() => setShowTerms(true)}
                    >Terms & Conditions</span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-gray-900">Terms & Conditions</h2>
                <button onClick={() => setShowTerms(false)} className="p-3 hover:bg-gray-100 rounded-2xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe
                src="/terms-policy"
                className="w-full h-96 border-0 rounded-2xl"
                title="Terms & Conditions"
              />
              <div className="flex gap-4 justify-end mt-8 pt-8 border-t">
                <button
                  onClick={() => setShowTerms(false)}
                  className="px-8 py-4 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-2xl transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setTermsAccepted(true);
                    setShowTerms(false);
                  }}
                  className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  I Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}