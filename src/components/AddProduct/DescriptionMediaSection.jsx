// src/components/AddProduct/DescriptionMediaSection.jsx
// v23 - SMALLER IMAGES + ADD MORE BUTTON

import React, { useEffect, useCallback } from "react";

export default function DescriptionMediaSection({
  form,
  onFieldChange,
  images,
  onImagesChange,
  errors,
  touched
}) {
  useEffect(() => {
    return () => images.previews.forEach(url => URL.revokeObjectURL(url));
  }, [images.previews]);

  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files).slice(0, 10 - images.files.length);
    const validationErrors = [];
    
    const validFiles = files.filter(file => {
      if (file.size > 5_000_000) {
        validationErrors.push(`${file.name}: File too large (max 5MB)`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        validationErrors.push(`${file.name}: Must be an image`);
        return false;
      }
      return true;
    });

    const previews = validFiles.map(file => URL.createObjectURL(file));
    
    if (validationErrors.length > 0) {
      console.warn('File validation errors:', validationErrors);
    }
    
    onImagesChange({
      files: [...images.files, ...validFiles],
      previews: [...images.previews, ...previews]
    });
    
    e.target.value = '';
  }, [images.files.length, images.previews.length, onImagesChange]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(images.previews[index]);
    onImagesChange({
      files: images.files.filter((_, i) => i !== index),
      previews: images.previews.filter((_, i) => i !== index)
    });
  }, [images.files, images.previews, onImagesChange]);

  const totalSizeMB = Math.floor(
    images.files.reduce((sum, f) => sum + f.size, 0) / 1_000_000
  );
  
  const imageCountClass = images.files.length === 0 
    ? 'border-red-500 ring-2 ring-red-200' 
    : images.files.length >= 10 
    ? 'border-orange-500 ring-2 ring-orange-200'
    : 'border-gray-300';

  const remainingSlots = 10 - images.files.length;

  return (
    <section className="space-y-6 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-white/50 shadow-2xl">
      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent border-b pb-4">
        📝 Description & Media
      </h2>

      {/* DESCRIPTION */}
      <div className="form-group space-y-2">
        <label htmlFor="field-description" className="block text-sm font-medium text-gray-700">
          Description *
        </label>
        <textarea
          id="field-description"
          rows="5"
          value={form.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          className={`w-full px-4 py-3 rounded-xl border transition-all focus:ring-4 focus:ring-blue-500 focus:border-blue-500 resize-vertical ${
            touched?.description && errors?.description 
              ? 'border-red-500 ring-2 ring-red-200' 
              : 'border-gray-300'
          }`}
          placeholder="Provide detailed description of your product, condition, and any unique features..."
        />
        {touched?.description && errors?.description && (
          <p className="text-sm text-red-600" role="alert">{errors.description}</p>
        )}
      </div>

      {/* IMAGES */}
      <div className="form-group space-y-2">
        <label htmlFor="field-images" className="block text-sm font-medium text-gray-700">
          Product Images * (Max 10, 5MB each)
        </label>
        <input
          id="field-images"
          type="file"
          multiple={remainingSlots > 1}
          accept="image/*"
          onChange={handleImageSelect}
          disabled={images.files.length >= 10}
          className={`w-full px-4 py-3 border rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${imageCountClass}`}
        />
        <p className="text-sm text-gray-500">
          {images.files.length}/10 images • {totalSizeMB}MB 
          {remainingSlots > 0 && ` • +${remainingSlots} more`}
        </p>
        {touched?.images && errors?.images && (
          <p className="text-sm text-red-600" role="alert">{errors.images}</p>
        )}
      </div>

      {/* 🔥 SMALLER IMAGE PREVIEWS + ADD MORE BUTTON */}
      {images.previews.length > 0 && (
        <div className="space-y-4">
          {/* Image Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {images.previews.map((src, index) => (
              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200">
                <img
                  src={src}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
                  aria-label={`Remove image ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* 🔥 ADD MORE BUTTON */}
          {remainingSlots > 0 && (
            <div className="flex justify-center">
              <label
                htmlFor="field-images"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer w-full sm:w-auto"
              >
                <span className="text-lg">+</span>
                Add {remainingSlots > 1 ? `${remainingSlots} more` : '1 more'} image{remainingSlots > 1 ? 's' : ''}
              </label>
            </div>
          )}
        </div>
      )}

      {/* VIDEO LINK */}
      <div className="form-group space-y-2">
        <label htmlFor="field-video_link" className="block text-sm font-medium text-gray-700">
          Video Link (Optional)
        </label>
        <input
          id="field-video_link"
          type="url"
          value={form.video_link}
          onChange={(e) => onFieldChange("video_link", e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400"
          placeholder="https://youtube.com/watch?v=... or https://tiktok.com/..."
        />
        <p className="text-xs text-gray-500">YouTube, TikTok, Instagram Reels supported</p>
      </div>
    </section>
  );
}