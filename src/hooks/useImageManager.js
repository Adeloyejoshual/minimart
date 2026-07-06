/**
 * hooks/useImageManager.js
 * Manages new uploads + existing images together.
 * Supports ordering across both lists.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";

const MAX_IMAGES = 6;
const MAX_SIZE   = 3 * 1024 * 1024;

const COMPRESS_BUDGET_LOW_END = { maxSizeMB: 0.5, maxWidthOrHeight: 800  };
const COMPRESS_BUDGET_NORMAL  = { maxSizeMB: 1,   maxWidthOrHeight: 1280 };

const getNetworkBudget = () => {
  const conn =
    navigator?.connection ??
    navigator?.mozConnection ??
    navigator?.webkitConnection;
  if (!conn) return COMPRESS_BUDGET_NORMAL;
  const slow =
    conn.effectiveType === "2g"      ||
    conn.effectiveType === "slow-2g" ||
    conn.saveData                    ||
    conn.downlink < 1;
  return slow ? COMPRESS_BUDGET_LOW_END : COMPRESS_BUDGET_NORMAL;
};

const verifyImageMagicBytes = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result);
      const hex = Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      resolve(
        hex.startsWith("ffd8ff")   ||
        hex.startsWith("89504e47") ||
        (hex.startsWith("52494646") && hex.slice(16, 24) === "57454250")
      );
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 12));
  });

export const hashImageFile = async (file) => {
  try {
    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
};

export function useImageManager({ showError, showSuccess }) {
  /* New uploads */
  const [images, setImages] = useState([]);

  /* Existing server images (edit mode) */
  const [existingImages,   setExistingImages]   = useState([]);
  const [removedImageKeys, setRemovedImageKeys] = useState([]);

  /* Compression progress */
  const [compressingCount, setCompressingCount] = useState(0);
  const [compressingTotal, setCompressingTotal] = useState(0);

  const mountedRef     = useRef(true);
  const sessionHashSet = useRef(new Set());
  const imagesRef      = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Keep ref in sync for cleanup */
  useEffect(() => { imagesRef.current = images; }, [images]);

  /* Revoke object URLs on unmount */
  useEffect(() => () => {
    imagesRef.current.forEach(
      (img) => img.preview && URL.revokeObjectURL(img.preview)
    );
  }, []);

  /* Total across existing + new */
  const totalImageCount = existingImages.length + images.length;

  /* ── Set existing images (edit mode load) ── */
  const loadExistingImages = useCallback((serverImages) => {
    setExistingImages(serverImages);
    setRemovedImageKeys([]);
  }, []);

  /* ── Remove existing image ── */
  const removeExistingImage = useCallback((imgId) => {
    setExistingImages((prev) => {
      const target = prev.find((x) => x.id === imgId);
      if (target?.r2_key) {
        setRemovedImageKeys((keys) => [...keys, target.r2_key]);
      }
      return prev.filter((x) => x.id !== imgId);
    });
  }, []);

  /* ── Add new images ── */
  const handleImages = useCallback(async (files) => {
    if (!mountedRef.current) return;

    const sizeFiltered = Array.from(files).filter((f) => f.size <= MAX_SIZE);
    if (!sizeFiltered.length) {
      showError("Images must be under 3 MB each");
      return;
    }

    const verified = await Promise.all(
      sizeFiltered.map(async (f) => ({
        file  : f,
        valid : await verifyImageMagicBytes(f),
      }))
    );
    const validFiles = verified.filter((v) => v.valid).map((v) => v.file);
    if (!validFiles.length) {
      showError("Only real JPEG, PNG, or WebP images allowed (max 3 MB)");
      return;
    }

    const budget = getNetworkBudget();
    if (mountedRef.current) {
      setCompressingTotal(validFiles.length);
      setCompressingCount(0);
    }

    const newImages = [];
    for (const file of validFiles) {
      if (!mountedRef.current) break;
      try {
        const compressed = await imageCompression(file, {
          ...budget,
          useWebWorker: true,
        }).catch(() => file);

        const hash = await hashImageFile(compressed);

        if (sessionHashSet.current.has(hash)) {
          if (mountedRef.current) setCompressingCount((p) => p + 1);
          continue;
        }

        sessionHashSet.current.add(hash);
        newImages.push({
          id      : `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file    : compressed,
          preview : URL.createObjectURL(compressed),
          hash,
          isNew   : true,
        });
      } catch { /* skip malformed */ }

      if (mountedRef.current) setCompressingCount((p) => p + 1);
    }

    if (!mountedRef.current) return;

    setImages((prev) => {
      /* FIX #1: check inside updater to avoid stale closure */
      const currentTotal = prev.length + existingImages.length;
      if (currentTotal >= MAX_IMAGES) {
        showError(`Maximum ${MAX_IMAGES} images allowed`);
        return prev;
      }
      const remaining = MAX_IMAGES - currentTotal;
      return [...prev, ...newImages.slice(0, remaining)];
    });

    setCompressingTotal(0);
    setCompressingCount(0);

    if (newImages.length > 0) {
      showSuccess(`${newImages.length} image${newImages.length > 1 ? "s" : ""} added`);
    }
  }, [existingImages.length, showError, showSuccess]);

  /* ── Remove new image ── */
  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      if (target?.hash)    sessionHashSet.current.delete(target.hash);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  /* ── FIX #8: Move image across BOTH existing + new lists ──
     We treat all images as a flat ordered list:
     [ ...existingImages, ...newImages ]
     Reordering updates whichever list the image belongs to.
  ── */
  const moveAllImages = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    /* Build flat list */
    const flat = [
      ...existingImages.map((img) => ({ ...img, _src: "existing" })),
      ...images.map((img)         => ({ ...img, _src: "new"      })),
    ];

    if (
      fromIndex < 0 || fromIndex >= flat.length ||
      toIndex   < 0 || toIndex   >= flat.length
    ) return;

    /* Reorder */
    const next    = [...flat];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    /* Split back */
    const newExisting = next
      .filter((img) => img._src === "existing")
      .map(({ _src, ...img }) => img); // eslint-disable-line no-unused-vars

    const newImages = next
      .filter((img) => img._src === "new")
      .map(({ _src, ...img }) => img); // eslint-disable-line no-unused-vars

    setExistingImages(newExisting);
    setImages(newImages);
  }, [existingImages, images]);

  /* Legacy move (new images only — kept for backward compat) */
  const moveImage = useCallback((fromIndex, toIndex) => {
    setImages((prev) => {
      if (
        fromIndex < 0 || fromIndex >= prev.length ||
        toIndex   < 0 || toIndex   >= prev.length ||
        fromIndex === toIndex
      ) return prev;
      const next    = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /* ── Reset (clear draft) ── */
  const resetImages = useCallback(() => {
    images.forEach((img) => img.preview && URL.revokeObjectURL(img.preview));
    setImages([]);
    setExistingImages([]);
    setRemovedImageKeys([]);
    sessionHashSet.current.clear();
  }, [images]);

  return {
    images,
    existingImages,
    removedImageKeys,
    totalImageCount,
    compressingCount,
    compressingTotal,
    loadExistingImages,
    handleImages,
    removeImage,
    removeExistingImage,
    moveImage,
    moveAllImages,
    resetImages,
    sessionHashSet,
  };
}