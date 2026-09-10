/**
 * src/pages/MarketDetail/SizeGuidePage.jsx
 */
import { useEffect, memo, useMemo } from "react";

const DEFAULT_ROWS = [
  { size: "S", chest: "36–38", waist: "30–32", length: "27" },
  { size: "M", chest: "38–40", waist: "32–34", length: "28" },
  { size: "L", chest: "40–42", waist: "34–36", length: "29" },
  { size: "XL", chest: "42–44", waist: "36–38", length: "30" },
  { size: "XXL", chest: "44–46", waist: "38–40", length: "31" },
];

function normalizeGuide(sizeGuide) {
  if (!sizeGuide) return { rows: DEFAULT_ROWS, image: null, html: null, note: null };

  if (typeof sizeGuide === "string") {
    const s = sizeGuide.trim();
    if (/^https?:\/\//i.test(s) || /\.(png|jpe?g|webp|gif)$/i.test(s)) {
      return { rows: null, image: s, html: null, note: null };
    }
    return { rows: null, image: null, html: s, note: null };
  }

  if (Array.isArray(sizeGuide)) {
    return { rows: sizeGuide, image: null, html: null, note: null };
  }

  return {
    rows: sizeGuide.rows || sizeGuide.chart || sizeGuide.sizes || DEFAULT_ROWS,
    image: sizeGuide.image || sizeGuide.chart_image || null,
    html: sizeGuide.html || sizeGuide.content || null,
    note: sizeGuide.note || sizeGuide.tip || null,
  };
}

const SizeGuidePage = memo(function SizeGuidePage({ isOpen, onClose, product, sizeGuide }) {
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = prev || "";
    };
  }, [isOpen, onClose]);

  const guide = useMemo(() => normalizeGuide(sizeGuide), [sizeGuide]);

  if (!isOpen) return null;

  const rows = Array.isArray(guide.rows) ? guide.rows : DEFAULT_ROWS;
  const keys = rows.length
    ? Object.keys(rows[0]).filter((k) => k !== "id")
    : ["size", "chest", "waist", "length"];

  return (
    <div className="mdp-subpage-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mdp-subpage" onClick={(e) => e.stopPropagation()}>
        <div className="mdp-subpage__header">
          <button type="button" className="mdp-subpage__back" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h2 className="mdp-subpage__title">Size Guide</h2>
          <span className="mdp-subpage__spacer" />
        </div>

        <div className="mdp-subpage__body">
          {product?.name && (
            <p className="mdp-size-product">{product.name}</p>
          )}

          {guide.note && <p className="mdp-size-note">{guide.note}</p>}

          {guide.image && (
            <div className="mdp-size-image-wrap">
              <img src={guide.image} alt="Size chart" className="mdp-size-image" />
            </div>
          )}

          {guide.html && !guide.image && (
            <div
              className="mdp-size-html"
              dangerouslySetInnerHTML={{ __html: guide.html }}
            />
          )}

          {rows?.length > 0 && (
            <div className="mdp-size-table-wrap">
              <table className="mdp-size-table">
                <thead>
                  <tr>
                    {keys.map((k) => (
                      <th key={k}>{String(k).replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {keys.map((k) => (
                        <td key={k}>{row[k] ?? row[k.toUpperCase()] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mdp-size-tips">
            <h4>How to measure</h4>
            <ul>
              <li><strong>Chest:</strong> Around the fullest part of your chest.</li>
              <li><strong>Waist:</strong> Around your natural waistline.</li>
              <li><strong>Length:</strong> From the highest shoulder point to the hem.</li>
            </ul>
            <p className="mdp-size-tip-foot">
              Measurements are approximate (inches). If between sizes, size up for a relaxed fit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SizeGuidePage;