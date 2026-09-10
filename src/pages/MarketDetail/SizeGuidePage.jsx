/**
 * src/pages/MarketDetail/SizeGuidePage.jsx
 */
import { useEffect, memo, useMemo, useState } from "react";
import "./styles/SizeGuidePage.css";

const DEFAULT_CLOTHES_ROWS = [
  { size: "S", chest: "36–38", waist: "30–32", length: "27" },
  { size: "M", chest: "38–40", waist: "32–34", length: "28" },
  { size: "L", chest: "40–42", waist: "34–36", length: "29" },
  { size: "XL", chest: "42–44", waist: "36–38", length: "30" },
  { size: "XXL", chest: "44–46", waist: "38–40", length: "31" },
];

const DEFAULT_SHOES_ROWS = [
  { us: "6", eu: "39", uk: "5.5", foot_cm: "24.1 cm" },
  { us: "7", eu: "40", uk: "6.5", foot_cm: "24.8 cm" },
  { us: "8", eu: "41", uk: "7.5", foot_cm: "25.4 cm" },
  { us: "9", eu: "42", uk: "8.5", foot_cm: "26.0 cm" },
  { us: "10", eu: "43", uk: "9.5", foot_cm: "26.7 cm" },
  { us: "11", eu: "44", uk: "10.5", foot_cm: "27.3 cm" },
  { us: "12", eu: "45", uk: "11.5", foot_cm: "27.9 cm" },
];

/** Detect if the product is a shoe/footwear */
function isFootwear(product) {
  if (!product) return false;
  const str = `${product.name || ""} ${product.category || ""} ${product.subcategory || ""} ${product.type || ""}`.toLowerCase();
  return /shoe|sneaker|boot|sandal|footwear|heel|loafer|slide|flipper|cleat|clog/i.test(str);
}

function normalizeGuide(sizeGuide, isShoe) {
  const fallbackRows = isShoe ? DEFAULT_SHOES_ROWS : DEFAULT_CLOTHES_ROWS;

  if (!sizeGuide) return { rows: fallbackRows, image: null, html: null, note: null };

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
    rows: sizeGuide.rows || sizeGuide.chart || sizeGuide.sizes || fallbackRows,
    image: sizeGuide.image || sizeGuide.chart_image || null,
    html: sizeGuide.html || sizeGuide.content || null,
    note: sizeGuide.note || sizeGuide.tip || null,
  };
}

const SizeGuidePage = memo(function SizeGuidePage({ isOpen, onClose, product, sizeGuide }) {
  // Detect product type default
  const detectedShoe = useMemo(() => isFootwear(product), [product]);
  const [guideType, setGuideType] = useState(() => (detectedShoe ? "shoes" : "clothes"));

  // Reset tab when product changes
  useEffect(() => {
    setGuideType(detectedShoe ? "shoes" : "clothes");
  }, [detectedShoe, product]);

  // Lock body scroll when modal is open
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

  const isShoe = guideType === "shoes";

  const guide = useMemo(
    () => normalizeGuide(sizeGuide, isShoe),
    [sizeGuide, isShoe]
  );

  if (!isOpen) return null;

  const rows = Array.isArray(guide.rows) ? guide.rows : (isShoe ? DEFAULT_SHOES_ROWS : DEFAULT_CLOTHES_ROWS);
  const keys = rows.length
    ? Object.keys(rows[0]).filter((k) => k !== "id")
    : isShoe
    ? ["us", "eu", "uk", "foot_cm"]
    : ["size", "chest", "waist", "length"];

  return (
    <div className="mdp-subpage-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mdp-subpage" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="mdp-subpage__header">
          <button type="button" className="mdp-subpage__back" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h2 className="mdp-subpage__title">
            {isShoe ? "Shoe Size Guide" : "Size Guide"}
          </h2>
          <span className="mdp-subpage__spacer" />
        </div>

        {/* Content Body */}
        <div className="mdp-subpage__body">
          
          {/* Category Toggle Tabs */}
          <div className="mdp-size-tabs">
            <button
              type="button"
              className={`mdp-size-tab ${guideType === "clothes" ? "active" : ""}`}
              onClick={() => setGuideType("clothes")}
            >
              Clothing
            </button>
            <button
              type="button"
              className={`mdp-size-tab ${guideType === "shoes" ? "active" : ""}`}
              onClick={() => setGuideType("shoes")}
            >
              Footwear / Shoes
            </button>
          </div>

          {product?.name && <p className="mdp-size-product">{product.name}</p>}

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

          {/* Size Table */}
          {rows?.length > 0 && (
            <div className="mdp-size-table-wrap">
              <table className="mdp-size-table">
                <thead>
                  <tr>
                    {keys.map((k) => (
                      <th key={k}>{String(k).replace(/_/g, " ").toUpperCase()}</th>
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

          {/* Dynamic Measurement Tips */}
          <div className="mdp-size-tips">
            <h4>{isShoe ? "How to measure your feet" : "How to measure"}</h4>
            {isShoe ? (
              <ul>
                <li><strong>Heel to Toe:</strong> Stand on a sheet of paper against a wall and mark your longest toe.</li>
                <li><strong>Measure length:</strong> Use a ruler to measure from the wall to the mark (in cm).</li>
                <li><strong>Fit Tip:</strong> If your foot measurement is between two sizes, choose the larger size.</li>
              </ul>
            ) : (
              <ul>
                <li><strong>Chest:</strong> Around the fullest part of your chest.</li>
                <li><strong>Waist:</strong> Around your natural waistline.</li>
                <li><strong>Length:</strong> From the highest shoulder point to the hem.</li>
              </ul>
            )}
            <p className="mdp-size-tip-foot">
              {isShoe
                ? "Sizing may vary slightly by brand. If you have wide feet, we recommend sizing up by 0.5 size."
                : "Measurements are approximate (inches). If between sizes, size up for a relaxed fit."}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
});

export default SizeGuidePage;