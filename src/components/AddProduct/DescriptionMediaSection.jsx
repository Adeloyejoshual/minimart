// src/components/AddProduct/DescriptionMediaSection.jsx
import React from "react";

export default function DescriptionMediaSection({
  form,
  images,
  setImages,
  fileInputRef,
  ui,
  handleChange
}) {
  /* ---------------- IMAGE HANDLERS (UI LEVEL ONLY) ---------------- */

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);

    const previews = files.map((file) =>
      URL.createObjectURL(file)
    );

    setImages((prev) => ({
      files: [...prev.files, ...files],
      previews: [...prev.previews, ...previews]
    }));
  };

  const removeImage = (index) => {
    setImages((prev) => ({
      files: prev.files.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  };

  return (
    <section style={{ marginBottom: "2rem" }}>
      <h2>📝 Description & Media</h2>

      {/* DESCRIPTION */}
      <div>
        <label>Description *</label>
        <textarea
          rows="5"
          value={form.description}
          onChange={(e) =>
            handleChange("description", e.target.value)
          }
          placeholder="Describe your product..."
        />
        {ui.errors?.description && (
          <small style={{ color: "red" }}>
            {ui.errors.description}
          </small>
        )}
      </div>

      {/* IMAGE UPLOAD */}
      <div style={{ marginTop: "1rem" }}>
        <label>Upload Images *</label>

        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageSelect}
          style={{ display: "block", marginTop: "0.5rem" }}
        />

        {ui.errors?.images && (
          <small style={{ color: "red" }}>
            {ui.errors.images}
          </small>
        )}
      </div>

      {/* IMAGE PREVIEWS */}
      {images.previews.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginTop: "1rem"
          }}
        >
          {images.previews.map((src, index) => (
            <div
              key={index}
              style={{
                position: "relative",
                width: "100px",
                height: "100px"
              }}
            >
              <img
                src={src}
                alt="preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "6px"
                }}
              />

              <button
                type="button"
                onClick={() => removeImage(index)}
                style={{
                  position: "absolute",
                  top: "-5px",
                  right: "-5px",
                  background: "red",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* VIDEO LINK */}
      <div style={{ marginTop: "1rem" }}>
        <label>Video Link (Optional)</label>
        <input
          type="text"
          value={form.video_link}
          onChange={(e) =>
            handleChange("video_link", e.target.value)
          }
          placeholder="YouTube / TikTok link"
        />
      </div>
    </section>
  );
}