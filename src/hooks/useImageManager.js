/**
 * hooks/useImageManager.js
 *
 * Immediate image previews with background validation, compression,
 * hashing, and duplicate detection.
 *
 * Features:
 * - Previews appear immediately after image selection.
 * - JPEG, PNG, and WebP magic-byte validation.
 * - Maximum file size: 5 MB per image.
 * - Maximum images: 6 (change MAX_IMAGES to 8 if required).
 * - Background compression using browser-image-compression.
 * - SHA-256 duplicate detection.
 * - Safe removal while processing.
 * - Existing server images supported in edit mode.
 * - Image reordering across existing and new images.
 * - Object URL cleanup.
 * - Prevents stale asynchronous processing from restoring removed images.
 * - Maintains compatibility with AddProduct.jsx.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

import imageCompression from "browser-image-compression";

/* ============================================================
   CONSTANTS
============================================================ */

const MAX_IMAGES = 6;
const MAX_SIZE = 5 * 1024 * 1024;

const COMPRESS_BUDGET_LOW_END = Object.freeze({
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
});

const COMPRESS_BUDGET_NORMAL = Object.freeze({
  maxSizeMB: 1,
  maxWidthOrHeight: 1280,
});

/* ============================================================
   HELPERS
============================================================ */

/**
 * Get a compression budget based on the available network information.
 */
const getNetworkBudget = () => {
  if (typeof navigator === "undefined") {
    return COMPRESS_BUDGET_NORMAL;
  }

  const connection =
    navigator.connection ??
    navigator.mozConnection ??
    navigator.webkitConnection ??
    null;

  if (!connection) {
    return COMPRESS_BUDGET_NORMAL;
  }

  const slowConnection =
    connection.effectiveType === "2g" ||
    connection.effectiveType === "slow-2g" ||
    connection.saveData === true ||
    (
      typeof connection.downlink === "number" &&
      connection.downlink < 1
    );

  return slowConnection
    ? COMPRESS_BUDGET_LOW_END
    : COMPRESS_BUDGET_NORMAL;
};

/**
 * Verify the actual image file signature.
 *
 * Accepted formats:
 * - JPEG
 * - PNG
 * - WebP
 */
const verifyImageMagicBytes = async (file) => {
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 3) {
      return false;
    }

    // JPEG
    const isJpeg =
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    if (isJpeg) {
      return true;
    }

    // PNG
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    if (isPng) {
      return true;
    }

    // WebP: RIFF....WEBP
    const isWebP =
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    return isWebP;
  } catch {
    return false;
  }
};

/**
 * Calculate a SHA-256 hash.
 *
 * This is used to identify duplicate image contents.
 */
export const hashImageFile = async (file) => {
  try {
    if (
      typeof crypto !== "undefined" &&
      crypto.subtle &&
      typeof crypto.subtle.digest === "function"
    ) {
      const buffer = await file.arrayBuffer();

      const digest = await crypto.subtle.digest(
        "SHA-256",
        buffer
      );

      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // Use the fallback below.
  }

  return [
    file.name,
    file.size,
    file.lastModified,
    file.type,
  ].join("-");
};

/**
 * Generate a unique ID for each selected image.
 */
const makeId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `new-${crypto.randomUUID()}`;
  }

  return `new-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

/**
 * Release a preview URL safely.
 */
const revokePreview = (preview) => {
  if (
    typeof preview === "string" &&
    preview.startsWith("blob:")
  ) {
    URL.revokeObjectURL(preview);
  }
};

/* ============================================================
   HOOK
============================================================ */

export function useImageManager({
  showError = () => {},
  showSuccess = () => {},
}) {
  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */

  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImageKeys, setRemovedImageKeys] = useState([]);

  const [compressingCount, setCompressingCount] = useState(0);
  const [compressingTotal, setCompressingTotal] = useState(0);

  /* ----------------------------------------------------------
     REFS
  ---------------------------------------------------------- */

  const mountedRef = useRef(false);

  const imagesRef = useRef([]);
  const existingImagesRef = useRef([]);
  const removedImageKeysRef = useRef([]);

  // Hashes belonging to images currently retained by this hook.
  const sessionHashSet = useRef(new Set());

  // Image IDs that are currently being processed.
  const processingIdsRef = useRef(new Set());

  // Image IDs explicitly removed or invalidated.
  const cancelledIdsRef = useRef(new Set());

  // Number of outstanding image-processing jobs.
  const pendingJobsRef = useRef(0);

  // Keeps asynchronous processing from writing into a reset draft.
  const generationRef = useRef(0);

  // Tracks IDs whose preview URLs have already been released.
  const revokedIdsRef = useRef(new Set());

  /* ----------------------------------------------------------
     STATE SYNCHRONIZATION
  ---------------------------------------------------------- */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      generationRef.current += 1;

      imagesRef.current.forEach((image) => {
        revokePreview(image.preview);
      });
    };
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    existingImagesRef.current = existingImages;
  }, [existingImages]);

  useEffect(() => {
    removedImageKeysRef.current = removedImageKeys;
  }, [removedImageKeys]);

  /* ----------------------------------------------------------
     REF-SAFE STATE UPDATERS

     Update the refs immediately so multiple actions occurring
     before React renders cannot rely on stale arrays.
  ---------------------------------------------------------- */

  const updateImages = useCallback((updater) => {
    const previous = imagesRef.current;

    const next =
      typeof updater === "function"
        ? updater(previous)
        : updater;

    imagesRef.current = next;

    if (mountedRef.current) {
      setImages(next);
    }

    return next;
  }, []);

  const updateExistingImages = useCallback((updater) => {
    const previous = existingImagesRef.current;

    const next =
      typeof updater === "function"
        ? updater(previous)
        : updater;

    existingImagesRef.current = next;

    if (mountedRef.current) {
      setExistingImages(next);
    }

    return next;
  }, []);

  const updateRemovedImageKeys = useCallback((updater) => {
    const previous = removedImageKeysRef.current;

    const next =
      typeof updater === "function"
        ? updater(previous)
        : updater;

    removedImageKeysRef.current = next;

    if (mountedRef.current) {
      setRemovedImageKeys(next);
    }

    return next;
  }, []);

  /* ----------------------------------------------------------
     DERIVED VALUES
  ---------------------------------------------------------- */

  const totalImageCount =
    existingImages.length + images.length;

  /* ----------------------------------------------------------
     PROGRESS MANAGEMENT
  ---------------------------------------------------------- */

  const startProcessingJob = useCallback(() => {
    pendingJobsRef.current += 1;

    if (mountedRef.current) {
      setCompressingTotal(pendingJobsRef.current);
      setCompressingCount(0);
    }
  }, []);

  const finishProcessingJob = useCallback(() => {
    pendingJobsRef.current = Math.max(
      0,
      pendingJobsRef.current - 1
    );

    if (mountedRef.current) {
      setCompressingTotal(pendingJobsRef.current);
      setCompressingCount((count) => count + 1);
    }
  }, []);

  const resetProgress = useCallback(() => {
    pendingJobsRef.current = 0;

    if (mountedRef.current) {
      setCompressingCount(0);
      setCompressingTotal(0);
    }
  }, []);

  /* ----------------------------------------------------------
     LOAD EXISTING IMAGES

     Used when editing a product.
  ---------------------------------------------------------- */

  const loadExistingImages = useCallback((serverImages) => {
    const next = Array.isArray(serverImages)
      ? serverImages
      : [];

    updateExistingImages(next);

    updateRemovedImageKeys([]);

  }, [
    updateExistingImages,
    updateRemovedImageKeys,
  ]);

  /* ----------------------------------------------------------
     REMOVE EXISTING SERVER IMAGE
  ---------------------------------------------------------- */

  const removeExistingImage = useCallback((imageId) => {
    const current = existingImagesRef.current;

    const target = current.find(
      (image) => image.id === imageId
    );

    if (!target) {
      return;
    }

    updateExistingImages((previous) =>
      previous.filter((image) => image.id !== imageId)
    );

    if (target.r2_key) {
      updateRemovedImageKeys((previous) => {
        if (previous.includes(target.r2_key)) {
          return previous;
        }

        return [...previous, target.r2_key];
      });
    }
  }, [
    updateExistingImages,
    updateRemovedImageKeys,
  ]);

  /* ----------------------------------------------------------
     PROCESS ONE IMAGE IN THE BACKGROUND

     The preview is created and displayed before this function
     begins. Processing updates the existing image entry instead
     of adding a second image.
  ---------------------------------------------------------- */

  const processImageInBackground = useCallback(
    async (imageId, originalFile, generation) => {
      try {
        const isCurrent = () =>
          mountedRef.current &&
          generationRef.current === generation &&
          !cancelledIdsRef.current.has(imageId);

        // Check whether the selected file is a real supported image.
        const isValid = await verifyImageMagicBytes(originalFile);

        if (!isCurrent()) {
          return;
        }

        if (!isValid) {
          cancelledIdsRef.current.add(imageId);

          updateImages((previous) =>
            previous.filter((image) => image.id !== imageId)
          );

          const image = imagesRef.current.find(
            (item) => item.id === imageId
          );

          if (image) {
            revokePreview(image.preview);
          }

          showError(
            "An image was skipped because it is not a valid JPEG, PNG, or WebP file."
          );

          return;
        }

        // Compress independently so images can process concurrently.
        const budget = getNetworkBudget();

        let processedFile = originalFile;

        try {
          const compressed = await imageCompression(
            originalFile,
            {
              ...budget,
              useWebWorker: true,
              maxIteration: 5,
              fileType: originalFile.type,
            }
          );

          if (compressed instanceof File) {
            processedFile = compressed;
          }
        } catch {
          // Keep the original file if compression fails.
          processedFile = originalFile;
        }

        if (!isCurrent()) {
          return;
        }

        // Calculate the hash after compression.
        const hash = await hashImageFile(processedFile);

        if (!isCurrent()) {
          return;
        }

        // Detect duplicates against images that have already
        // finished processing.
        const duplicate = sessionHashSet.current.has(hash);

        if (duplicate) {
          cancelledIdsRef.current.add(imageId);

          const duplicateImage = imagesRef.current.find(
            (image) => image.id === imageId
          );

          updateImages((previous) =>
            previous.filter((image) => image.id !== imageId)
          );

          if (duplicateImage) {
            revokePreview(duplicateImage.preview);
          }

          showError(
            "A duplicate image was skipped."
          );

          return;
        }

        sessionHashSet.current.add(hash);

        // Replace the original File with the processed File.
        // Keep the existing preview URL to avoid reloading it.
        updateImages((previous) =>
          previous.map((image) => {
            if (image.id !== imageId) {
              return image;
            }

            return {
              ...image,
              file: processedFile,
              hash,
              isNew: true,
              processing: false,
              error: null,
            };
          })
        );
      } catch {
        if (!mountedRef.current) {
          return;
        }

        if (
          generationRef.current !== generation ||
          cancelledIdsRef.current.has(imageId)
        ) {
          return;
        }

        const failedImage = imagesRef.current.find(
          (image) => image.id === imageId
        );

        if (failedImage) {
          updateImages((previous) =>
            previous.map((image) =>
              image.id === imageId
                ? {
                    ...image,
                    processing: false,
                    error: "Image processing failed.",
                  }
                : image
            )
          );
        }
      } finally {
        processingIdsRef.current.delete(imageId);

        finishProcessingJob();
      }
    },
    [
      updateImages,
      showError,
      finishProcessingJob,
    ]
  );

  /* ----------------------------------------------------------
     ADD NEW IMAGES

     IMPORTANT:
     The previews are added to state synchronously before any
     file validation, compression, or hashing is awaited.
  ---------------------------------------------------------- */

  const handleImages = useCallback((fileList) => {
    if (!mountedRef.current) {
      return;
    }

    const selectedFiles = Array.from(fileList ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    const existingCount =
      existingImagesRef.current.length +
      imagesRef.current.length;

    const availableSlots = Math.max(
      0,
      MAX_IMAGES - existingCount
    );

    if (availableSlots === 0) {
      showError(
        `Maximum ${MAX_IMAGES} images allowed.`
      );

      return;
    }

    // Only accept files that are within the configured size limit.
    const acceptedBySize = [];
    let oversizedCount = 0;

    for (const file of selectedFiles) {
      if (file.size > MAX_SIZE) {
        oversizedCount += 1;
        continue;
      }

      acceptedBySize.push(file);
    }

    if (oversizedCount > 0) {
      showError(
        `${oversizedCount} image${
          oversizedCount === 1 ? "" : "s"
        } skipped. Each image must be 5 MB or smaller.`
      );
    }

    if (acceptedBySize.length === 0) {
      return;
    }

    // Do not create previews beyond the remaining available slots.
    const filesToAdd = acceptedBySize.slice(
      0,
      availableSlots
    );

    const excessCount =
      acceptedBySize.length - filesToAdd.length;

    if (excessCount > 0) {
      showError(
        `Only ${availableSlots} slot${
          availableSlots === 1 ? "" : "s"
        } available. ${excessCount} image${
          excessCount === 1 ? "" : "s"
        } skipped.`
      );
    }

    const generation = generationRef.current;

    // Create all preview URLs immediately.
    const immediateImages = filesToAdd.map((file) => {
      const id = makeId();

      return {
        id,
        file,
        preview: URL.createObjectURL(file),
        hash: null,
        isNew: true,
        processing: true,
        error: null,
      };
    });

    // Update React state BEFORE background processing starts.
    updateImages((previous) => [
      ...previous,
      ...immediateImages,
    ]);

    // Process every image independently in the background.
    // Do not await these promises here.
    for (const image of immediateImages) {
      processingIdsRef.current.add(image.id);

      startProcessingJob();

      void processImageInBackground(
        image.id,
        image.file,
        generation
      );
    }
  }, [
    updateImages,
    showError,
    processImageInBackground,
    startProcessingJob,
  ]);

  /* ----------------------------------------------------------
     REMOVE NEW IMAGE
  ---------------------------------------------------------- */

  const removeImage = useCallback((imageId) => {
    const current = imagesRef.current;

    const target = current.find(
      (image) => image.id === imageId
    );

    if (!target) {
      return;
    }

    // Prevent a pending async operation from restoring this image.
    cancelledIdsRef.current.add(imageId);

    // Release its duplicate hash if it has already been registered.
    if (target.hash) {
      sessionHashSet.current.delete(target.hash);
    }

    updateImages((previous) =>
      previous.filter((image) => image.id !== imageId)
    );

    revokePreview(target.preview);
  }, [updateImages]);

  /* ----------------------------------------------------------
     REORDER NEW IMAGES
  ---------------------------------------------------------- */

  const moveImage = useCallback((fromIndex, toIndex) => {
    updateImages((previous) => {
      if (
        fromIndex < 0 ||
        fromIndex >= previous.length ||
        toIndex < 0 ||
        toIndex >= previous.length ||
        fromIndex === toIndex
      ) {
        return previous;
      }

      const next = [...previous];

      const [moved] = next.splice(fromIndex, 1);

      next.splice(toIndex, 0, moved);

      return next;
    });
  }, [updateImages]);

  /* ----------------------------------------------------------
     REORDER EXISTING AND NEW IMAGES TOGETHER
  ---------------------------------------------------------- */

  const moveAllImages = useCallback((fromIndex, toIndex) => {
    const existing = existingImagesRef.current;
    const current = imagesRef.current;

    const combined = [
      ...existing.map((image) => ({
        ...image,
        _source: "existing",
      })),
      ...current.map((image) => ({
        ...image,
        _source: "new",
      })),
    ];

    if (
      fromIndex < 0 ||
      fromIndex >= combined.length ||
      toIndex < 0 ||
      toIndex >= combined.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const next = [...combined];

    const [moved] = next.splice(fromIndex, 1);

    next.splice(toIndex, 0, moved);

    updateExistingImages(
      next
        .filter((image) => image._source === "existing")
        .map(({ _source, ...image }) => image)
    );

    updateImages(
      next
        .filter((image) => image._source === "new")
        .map(({ _source, ...image }) => image)
    );
  }, [
    updateImages,
    updateExistingImages,
  ]);

  /* ----------------------------------------------------------
     RESET IMAGE STATE
  ---------------------------------------------------------- */

  const resetImages = useCallback(() => {
    // Invalidate all ongoing processing jobs.
    generationRef.current += 1;

    // Release preview URLs currently retained in state.
    imagesRef.current.forEach((image) => {
      revokePreview(image.preview);
    });

    imagesRef.current = [];
    existingImagesRef.current = [];
    removedImageKeysRef.current = [];

    sessionHashSet.current.clear();
    processingIdsRef.current.clear();
    cancelledIdsRef.current.clear();

    updateImages([]);
    updateExistingImages([]);
    updateRemovedImageKeys([]);

    resetProgress();
  }, [
    updateImages,
    updateExistingImages,
    updateRemovedImageKeys,
    resetProgress,
  ]);

  /* ----------------------------------------------------------
     WAIT FOR PENDING IMAGE PROCESSING

     This helper allows AddProduct.jsx to wait until background
     processing finishes before submitting a product.
  ---------------------------------------------------------- */

  const waitForImageProcessing = useCallback(async () => {
    while (
      mountedRef.current &&
      processingIdsRef.current.size > 0
    ) {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    }
  }, []);

  /* ----------------------------------------------------------
     PUBLIC API
  ---------------------------------------------------------- */

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

    waitForImageProcessing,

    sessionHashSet,
  };
}