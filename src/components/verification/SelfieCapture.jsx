import { useEffect, useRef, useState } from "react";
import { Camera, Image, X, RefreshCw, User } from "lucide-react";

export function SelfieCapture({ file, onFile, onRemove }) {
  const inputRef         = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const trigger = (capture) => {
    if (capture) {
      inputRef.current?.setAttribute("capture", "user");
    } else {
      inputRef.current?.removeAttribute("capture");
    }
    inputRef.current?.click();
  };

  return (
    <div className="selfie-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="upload-hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onFile(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {/* preview circle */}
      <div className="selfie-circle">
        {preview ? (
          <img src={preview} alt="Selfie preview" />
        ) : (
          <div className="selfie-empty">
            <User size={40} />
            <span>No photo</span>
          </div>
        )}
      </div>

      {/* guide text */}
      <p className="selfie-guide">
        Ensure your face is clearly visible, well-lit, and matches your ID.
      </p>

      {/* buttons */}
      <div className="selfie-actions">
        {file ? (
          <>
            <button
              type="button"
              className="v-btn v-btn--ghost v-btn--sm"
              onClick={() => trigger(true)}
            >
              <RefreshCw size={13} /> Retake
            </button>
            <button
              type="button"
              className="v-btn v-btn--ghost v-btn--sm"
              onClick={onRemove}
            >
              <X size={13} /> Remove
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="v-btn v-btn--primary v-btn--sm"
              onClick={() => trigger(true)}
            >
              <Camera size={13} /> Open Camera
            </button>
            <button
              type="button"
              className="v-btn v-btn--ghost v-btn--sm"
              onClick={() => trigger(false)}
            >
              <Image size={13} /> Choose Photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}