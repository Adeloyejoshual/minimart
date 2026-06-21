import { useEffect, useState, useRef } from "react";
import { Upload, FileText, X, AlertCircle } from "lucide-react";

const fmt = (b) =>
  b < 1_048_576
    ? `${(b / 1_024).toFixed(0)} KB`
    : `${(b / 1_048_576).toFixed(1)} MB`;

export function FileUpload({
  label,
  hint,
  accept   = "image/*,.pdf",
  file,
  onFile,
  onRemove,
  maxBytes,
  required = false,
}) {
  const inputRef          = useRef(null);
  const [preview, setPreview]     = useState(null);
  const [fileErr, setFileErr]     = useState("");
  const [dragging, setDragging]   = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validate = (picked) => {
    if (!picked) return;
    setFileErr("");

    if (maxBytes && picked.size > maxBytes) {
      setFileErr(
        `Too large — max ${fmt(maxBytes)}, your file is ${fmt(picked.size)}.`
      );
      return;
    }
    onFile(picked);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    validate(e.dataTransfer.files?.[0]);
  };

  /* ── has file ── */
  if (file) {
    return (
      <div className="upload-card upload-card--filled">
        <div className="upload-preview-row">
          {preview ? (
            <img src={preview} alt="" className="upload-thumb" />
          ) : (
            <div className="upload-thumb upload-thumb--doc">
              <FileText size={22} />
            </div>
          )}
          <div className="upload-meta">
            <p className="upload-filename">{file.name}</p>
            <p className="upload-filesize">{fmt(file.size)}</p>
          </div>
          <button
            type="button"
            className="upload-remove-btn"
            onClick={onRemove}
            aria-label="Remove file"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  /* ── empty ── */
  return (
    <div>
      <label
        className={[
          "upload-card",
          dragging ? "upload-card--drag" : "",
          fileErr  ? "upload-card--error" : "",
          required ? "upload-card--required" : "",
        ].join(" ")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true);  }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="upload-hidden"
          onChange={(e) => {
            validate(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Upload size={22} className="upload-icon" />
        <p className="upload-label">{label}</p>
        <p className="upload-hint">{hint}</p>
        {dragging && (
          <p className="upload-drop-cue">Drop to upload</p>
        )}
      </label>

      {fileErr && (
        <div className="upload-file-error">
          <AlertCircle size={13} />
          <span>{fileErr}</span>
        </div>
      )}
    </div>
  );
}