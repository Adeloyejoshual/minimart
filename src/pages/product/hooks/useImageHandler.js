// src/pages/product/hooks/useImageHandler.js
import { useState, useCallback } from "react";
import imageCompression from "browser-image-compression";

export const MAX_IMAGES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

export function useImageHandler() {
  const [images, setImages] = useState([]);

  const showError = useCallback((msg) => {
    alert(msg); // adapt to your toast/error component
  }, []);

  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch {
      return file;
    }
  };

  const handleImages = useCallback(
    async (files) => {
      const fileArray = Array.from(files || []);
      const currentCount = images.length;
      if (currentCount >= MAX_IMAGES) {
        showError(`Maximum ${MAX_IMAGES} images allowed`);
        return;
      }

      const remaining = MAX_IMAGES - currentCount;
      const validFiles = fileArray
        .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
        .slice(0, remaining);

      if (validFiles.length === 0) {
        showError("Please upload valid images (≤ 3MB each)");
        return;
      }

      const compressed = await Promise.all(validFiles.map((file) => compressImage(file)));
      const newImages = compressed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));

      setImages((prev) => [...prev, ...newImages]);
      const added = compressed.length;
      if (added > 0) {
        alert(`${added} image(s) added`); // or your toast
      }
    },
    [images.length, showError]
  );

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  return {
    images,
    handleImages,
    removeImage,
    MAX_IMAGES,
  };
}