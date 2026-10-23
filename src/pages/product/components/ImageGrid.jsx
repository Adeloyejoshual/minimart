import React from 'react';
import { X, AlertTriangle, AlertCircle, Plus, Image as ImageIcon } from 'lucide-react';

export default function ImageGrid({
  images = [],
  onRemove,
  onFileSelect,
  maxImages = 8,
  error = null,
  warning = null,
}) {
  const canAddMore = images.length < maxImages;

  return (
    <div className="w-full space-y-3">
      {/* Images Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, index) => {
          // Supports blob URLs, base64 strings, or uploaded URLs
          const previewUrl = typeof img === 'string' ? img : (img.preview || img.url);
          const hasError = !!img.error;
          const hasWarning = !!img.warning;

          return (
            <div
              key={img.id || index}
              className={`relative group rounded-xl overflow-hidden aspect-square border-2 bg-slate-900/5 transition-all duration-150 ${
                hasError
                  ? 'border-red-500 ring-2 ring-red-500/20'
                  : hasWarning
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-orange-400'
              }`}
            >
              {/* Instant Image Thumbnail */}
              <img
                src={previewUrl}
                alt={`Product detail ${index + 1}`}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="sync"
              />

              {/* First Image Indicator */}
              {index === 0 && (
                <span className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm z-10">
                  Cover Photo
                </span>
              )}

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded-full backdrop-blur-sm transition-all z-20 hover:scale-105 active:scale-95"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Per-Image Warning / Error Banner (Displayed directly over the affected thumbnail) */}
              {(hasError || hasWarning) && (
                <div
                  className={`absolute bottom-0 inset-x-0 p-1.5 text-xs font-medium backdrop-blur-md flex items-center gap-1.5 z-10 ${
                    hasError ? 'bg-red-900/90 text-red-100' : 'bg-amber-900/90 text-amber-100'
                  }`}
                >
                  {hasError ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  )}
                  <span className="truncate text-[11px] leading-tight">
                    {img.error || img.warning}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Tap to Add Photos Dropzone Box */}
        {canAddMore && (
          <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/50 hover:bg-orange-50 rounded-xl aspect-square cursor-pointer transition-colors p-3 text-center group">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={onFileSelect}
            />
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              {images.length === 0 ? <ImageIcon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <span className="text-xs font-semibold text-orange-700">
              {images.length === 0 ? 'Tap to add photos' : 'Add More'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {images.length}/{maxImages} images
            </span>
          </label>
        )}
      </div>

      {/* DIRECT INLINE FEEDBACK: Rendered directly beneath the affected photo grid */}
      {(error || warning) && (
        <div className="space-y-1.5 pt-1">
          {error && (
            <div className="flex items-start gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}
          {warning && (
            <div className="flex items-start gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{warning}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}