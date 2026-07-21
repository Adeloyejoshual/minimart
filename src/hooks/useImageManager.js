/**
 * hooks/useImageManager.js
 *
 * Manages new uploads + existing server images together.
 * Supports ordering across both lists.
 *
 * Changes from previous version:
 *  - MAX_SIZE raised to 5 MB to match backend multer limit
 *  - All callbacks use refs instead of closed-over state to
 *    eliminate stale-closure bugs in handleImages / moveAllImages / resetImages
 *  - existingImagesRef kept in sync for use inside setImages updater
 *  - handleImages dep array reduced to [showError, showSuccess] only
 *  - moveAllImages dep array is [] — reads from refs
 *  - resetImages dep array is []  — reads from refs
 */

import { useState, useCallback, useRef, useEffect } from "react";
import imageCompression from "browser-image-compression";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const MAX_IMAGES = 6;
const MAX_SIZE   = 5 * 1024 * 1024;   // 5 MB — matches backend multer limit

const COMPRESS_BUDGET_LOW_END = Object.freeze({
  maxSizeMB       : 0.5,
  maxWidthOrHeight: 800,
});
const COMPRESS_BUDGET_NORMAL = Object.freeze({
  maxSizeMB       : 1,
  maxWidthOrHeight: 1_280,
});

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */

/** Pick compression budget based on network conditions */
const getNetworkBudget = () => {
  const conn =
    navigator?.connection ??
    navigator?.mozConnection ??
    navigator?.webkitConnection ??
    null;

  if (!conn) return COMPRESS_BUDGET_NORMAL;

  const slow =
    conn.effectiveType === "2g"      ||
    conn.effectiveType === "slow-2g" ||
    conn.saveData === true           ||
    (typeof conn.downlink === "number" && conn.downlink < 1);

  return slow ? COMPRESS_BUDGET_LOW_END : COMPRESS_BUDGET_NORMAL;
};

/**
 * Read the first 12 bytes and check magic numbers.
 * Accepts JPEG, PNG, WebP only.
 */
const verifyImageMagicBytes = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result);
      const hex = Array.from(arr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const isJpeg = hex.startsWith("ffd8ff");
      const isPng  = hex.startsWith("89504e47");
      const isWebP =
        hex.startsWith("52494646") && hex.slice(16, 24) === "57454250";

      resolve(isJpeg || isPng || isWebP);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 12));
  });

/**
 * SHA-256 hash of a File.
 * Falls back to a deterministic string if SubtleCrypto is unavailable.
 */
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

/** Generate a stable unique ID for a new image slot */
const makeId = () =>
  `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useImageManager({ showError, showSuccess }) {

  /* ── State ── */
  const [images,           setImages]           = useState([]);
  const [existingImages,   setExistingImages]   = useState([]);
  const [removedImageKeys, setRemovedImageKeys] = useState([]);
  const [compressingCount, setCompressingCount] = useState(0);
  const [compressingTotal, setCompressingTotal] = useState(0);

  /* ── Refs ── */
  const mountedRef         = useRef(true);
  const sessionHashSet     = useRef(new Set());   // dedup across this session
  const imagesRef          = useRef([]);           // mirrors images state
  const existingImagesRef  = useRef([]);           // mirrors existingImages state

  /* ── Lifecycle ── */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Keep refs in sync with state */
  useEffect(() => { imagesRef.current        = images;         }, [images]);
  useEffect(() => { existingImagesRef.current = existingImages; }, [existingImages]);

  /* Revoke all object URLs on unmount */
  useEffect(() => {
    return () => {
      imagesRef.current.forEach(
        (img) => img.preview && URL.revokeObjectURL(img.preview)
      );
    };
  }, []);

  /* ── Derived ── */
  const totalImageCount = existingImages.length + images.length;

  /* ═══════════════════════════════════════════════════════════
     LOAD EXISTING IMAGES  (edit mode)
  ═══════════════════════════════════════════════════════════ */
  const loadExistingImages = useCallback((serverImages) => {
    setExistingImages(serverImages ?? []);
    setRemovedImageKeys([]);
  }, []);

  /* ═══════════════════════════════════════════════════════════
     REMOVE EXISTING IMAGE
  ═══════════════════════════════════════════════════════════ */
  const removeExistingImage = useCallback((imgId) => {
    setExistingImages((prev) => {
      const target = prev.find((x) => x.id === imgId);
      if (target?.r2_key) {
        setRemovedImageKeys((keys) => [...keys, target.r2_key]);
      }
      return prev.filter((x) => x.id !== imgId);
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     ADD NEW IMAGES
     Steps:
       1. Filter oversized files
       2. Verify magic bytes (no fake extensions)
       3. Compress per network budget
       4. Hash → deduplicate within session
       5. Append up to remaining slot count
  ═══════════════════════════════════════════════════════════ */
  const handleImages = useCallback(async (files) => {
    if (!mountedRef.current) return;

    /* ── 1. Size gate ── */
    const allFiles     = Array.from(files ?? []);
    const sizeOk       = allFiles.filter((f) => f.size <= MAX_SIZE);
    const sizeRejected = allFiles.length - sizeOk.length;

    if (sizeRejected > 0) {
      showError(
        sizeRejected === allFiles.length
          ? `Images must be under 5 MB each.`
          : `${sizeRejected} image${sizeRejected > 1 ? "s" : ""} skipped — must be under 5 MB each.`
      );
      if (!sizeOk.length) return;
    }

    /* ── 2. Magic-byte verification ── */
    const verified = await Promise.all(
      sizeOk.map(async (f) => ({
        file  : f,
        valid : await verifyImageMagicBytes(f),
      }))
    );
    const validFiles = verified.filter((v) => v.valid).map((v) => v.file);

    if (!validFiles.length) {
      showError("Only real JPEG, PNG, or WebP images are allowed (max 5 MB).");
      return;
    }

    /* ── 3. Initialise progress ── */
    const budget = getNetworkBudget();
    if (mountedRef.current) {
      setCompressingTotal(validFiles.length);
      setCompressingCount(0);
    }

    /* ── 4. Compress + hash + deduplicate ── */
    const newImages = [];

    for (const file of validFiles) {
      if (!mountedRef.current) break;

      try {
        const compressed = await imageCompression(file, {
          ...budget,
          useWebWorker: true,
        }).catch(() => file);   // fallback: use original if compression fails

        const hash = await hashImageFile(compressed);

        if (sessionHashSet.current.has(hash)) {
          /* Silently skip — already in the list */
          if (mountedRef.current) setCompressingCount((n) => n + 1);
          continue;
        }

        sessionHashSet.current.add(hash);

        newImages.push({
          id     : makeId(),
          file   : compressed,
          preview: URL.createObjectURL(compressed),
          hash,
          isNew  : true,
        });
      } catch {
        /* Skip malformed/corrupt files silently */
      }

      if (mountedRef.current) setCompressingCount((n) => n + 1);
    }

    if (!mountedRef.current) return;

    /* ── 5. Append up to remaining slots ──
       Read existingImagesRef.current inside the updater so we never
       use a stale closure value for existingImages.length.
    ── */
    setImages((prev) => {
      const currentTotal = prev.length + existingImagesRef.current.length;

      if (currentTotal >= MAX_IMAGES) {
        showError(`Maximum ${MAX_IMAGES} images allowed.`);
        return prev;
      }

      const remaining = MAX_IMAGES - currentTotal;
      const toAdd     = newImages.slice(0, remaining);

      if (newImages.length > remaining) {
        showError(
          `Only ${remaining} slot${remaining !== 1 ? "s" : ""} left — ` +
          `${newImages.length - remaining} image${newImages.length - remaining !== 1 ? "s" : ""} skipped.`
        );
      }

      return [...prev, ...toAdd];
    });

    /* Reset progress */
    if (mountedRef.current) {
      setCompressingTotal(0);
      setCompressingCount(0);
    }

    if (newImages.length > 0) {
      showSuccess(
        `${newImages.length} image${newImages.length > 1 ? "s" : ""} added.`
      );
    }
  }, [showError, showSuccess]);
  // ↑ existingImages / images intentionally NOT in deps — read via refs

  /* ═══════════════════════════════════════════════════════════
     REMOVE NEW IMAGE
  ═══════════════════════════════════════════════════════════ */
  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      if (target?.hash)    sessionHashSet.current.delete(target.hash);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     MOVE IMAGE  (across both existing + new lists)

     Treats [ ...existingImages, ...newImages ] as one flat list.
     After reorder, splits back into the two state arrays.
     Reads from refs — no stale closures, dep array is [].
  ═══════════════════════════════════════════════════════════ */
  const moveAllImages = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const existing = existingImagesRef.current;
    const current  = imagesRef.current;

    const flat = [
      ...existing.map((img) => ({ ...img, _src: "existing" })),
      ...current.map((img)  => ({ ...img, _src: "new"      })),
    ];

    if (
      fromIndex < 0 || fromIndex >= flat.length ||
      toIndex   < 0 || toIndex   >= flat.length
    ) return;

    const next    = [...flat];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setExistingImages(
      next
        .filter((img) => img._src === "existing")
        .map(({ _src, ...img }) => img)
    );
    setImages(
      next
        .filter((img) => img._src === "new")
        .map(({ _src, ...img }) => img)
    );
  }, []);
  // ↑ reads existingImagesRef + imagesRef — no deps needed

  /* Legacy move (new images only — kept for backward compatibility) */
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

  /* ═══════════════════════════════════════════════════════════
     RESET  (clear draft)
     Reads imagesRef — no stale closure on images state.
  ═══════════════════════════════════════════════════════════ */
  const resetImages = useCallback(() => {
    imagesRef.current.forEach(
      (img) => img.preview && URL.revokeObjectURL(img.preview)
    );
    setImages([]);
    setExistingImages([]);
    setRemovedImageKeys([]);
    sessionHashSet.current.clear();
  }, []);
  // ↑ reads imagesRef — no deps needed

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════════ */
  return {
    /* State */
    images,
    existingImages,
    removedImageKeys,
    totalImageCount,
    compressingCount,
    compressingTotal,

    /* Actions */
    loadExistingImages,
    handleImages,
    removeImage,
    removeExistingImage,
    moveImage,
    moveAllImages,
    resetImages,

    /* Exposed for advanced use (e.g. duplicate check in components.jsx) */
    sessionHashSet,
  };
}