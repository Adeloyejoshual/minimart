/**
 * src/product/shared/ImagesSection.jsx
 * Existing images (edit mode) + new uploads with drag/drop, reorder
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import SectionDot         from "../components/SectionDot.jsx";
import ExistingImageGrid  from "../components/ExistingImageGrid.jsx";
import ImageGrid          from "../components/ImageGrid.jsx";
import { WarningIcon }    from "../components/icons/index.jsx";

/* Hash file for duplicate detection */
async function hashImageFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const hash   = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

export default function ImagesSection({ innerRef }) {
  const {
    images, existingImages, removeExistingImage,
    totalImageCount, MAX_IMAGES,
    handleImages, removeImage, moveAllImages,
    isEditMode,
  } = useAddProductContext();

  const [imageErrors, setImageErrors] = useState({});
  const [isDragging,  setIsDragging]  = useState(false);

  const sessionHashMap  = useRef(new Map());
  const validationQueue = useRef(Promise.resolve());
  const validatedIdsRef = useRef(new Set());
  const dropZoneRef     = useRef(null);
  const dragCounterRef  = useRef(0);

  /* ── Validation ── */
  const _validateImages = useCallback(async (incoming) => {
    const errors = {};
    const newMap = new Map(sessionHashMap.current);

    for (const img of incoming) {
      if (!["image/jpeg","image/png","image/webp"].includes(img.file.type)) {
        errors[img.id] = "Wrong type — use JPEG, PNG or WebP"; continue;
      }
      if (img.file.size > 3 * 1024 * 1024) {
        errors[img.id] =
          `Too large (${(img.file.size / 1_048_576).toFixed(1)} MB) — max 3 MB`;
        continue;
      }
      if (validatedIdsRef.current.has(img.id)) continue;

      const hash = await hashImageFile(img.file);
      const dup  = [...newMap.entries()].some(
        ([id, h]) => h === hash && id !== img.id
      );
      if (dup) {
        errors[img.id] = "Duplicate — this photo is already added";
        continue;
      }
      newMap.set(img.id, hash);
      validatedIdsRef.current.add(img.id);
    }

    sessionHashMap.current = newMap;
    setImageErrors((prev) => {
      const next = { ...prev };
      incoming.forEach((img) => {
        if (errors[img.id]) next[img.id] = errors[img.id];
        else delete next[img.id];
      });
      return next;
    });
  }, []);

  const validateAndHashImages = useCallback((incoming) => {
    validationQueue.current = validationQueue.current
      .then(() => _validateImages(incoming))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn("[ImageValidation]", err);
      });
  }, [_validateImages]);

  useEffect(() => {
    if (!images.length) return;
    const newImgs = images.filter((img) => !validatedIdsRef.current.has(img.id));
    if (!newImgs.length) return;
    validateAndHashImages(newImgs);
  }, [images, validateAndHashImages]);

  useEffect(() => {
    const ids = new Set(images.map((i) => i.id));
    for (const id of validatedIdsRef.current) {
      if (!ids.has(id)) {
        sessionHashMap.current.delete(id);
        validatedIdsRef.current.delete(id);
      }
    }
  }, [images]);

  /* ── Drag/drop ── */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault(); dragCounterRef.current += 1; setIsDragging(true);
  }, []);
  const handleDragOver = useCallback((e) => e.preventDefault(), []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) handleImages(e.dataTransfer.files);
  }, [handleImages]);

  const canAddMore     = totalImageCount < MAX_IMAGES;
  const hasImageErrors = Object.keys(imageErrors).length > 0;
  const imagesFilled   = totalImageCount > 0 && !hasImageErrors;

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Product Images * <SectionDot filled={imagesFilled} />
      </h3>

      <div className="image-count-status">
        <span className={`image-count-badge${totalImageCount >= MAX_IMAGES ? " image-count-badge--full" : ""}`}>
          {totalImageCount}/{MAX_IMAGES} images
        </span>
        {isEditMode && existingImages.length > 0 && (
          <span className="image-count-existing">
            {existingImages.length} existing · {images.length} new
          </span>
        )}
      </div>

      {hasImageErrors && (
        <div className="form-error" role="alert" style={{ marginBottom: 10 }}>
          <WarningIcon />{" "}
          {Object.keys(imageErrors).length} image
          {Object.keys(imageErrors).length !== 1 ? "s have" : " has"} errors
          — fix before submitting
        </div>
      )}

      {isEditMode && (
        <ExistingImageGrid
          existingImages={existingImages}
          onRemove={removeExistingImage}
        />
      )}

      {canAddMore && (
        <ImageGrid
          images={images}
          imageErrors={imageErrors}
          MAX_IMAGES={MAX_IMAGES}
          canAddMore={canAddMore}
          isDragging={isDragging}
          dropZoneRef={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onRemove={(id) => {
            removeImage(id);
            setImageErrors((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }}
          onMove={moveAllImages}
          onAdd={handleImages}
        />
      )}

      {!canAddMore && (
        <p className="image-limit-reached">
          Maximum {MAX_IMAGES} images reached.
          {isEditMode && " Remove an existing image to add a new one."}
        </p>
      )}

      {totalImageCount > 0 && (
        <div className="image-footer">
          <small className="image-count">
            {totalImageCount}/{MAX_IMAGES} images
          </small>
          <small className="field-hint">
            {isEditMode
              ? "Remove existing images above or add new ones below"
              : "First image is the main photo · drag to reorder"}
          </small>
        </div>
      )}
    </section>
  );
}