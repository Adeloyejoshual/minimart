import { FiTrash2, FiPlus } from "react-icons/fi";
import { updateList, addToList, removeFromList } from "./utils";

export default function ProductInfoStep({
  name,          setName,
  description,   setDescription,
  brandId,       setBrandId,
  warranty,      setWarranty,
  returnPolicy,  setReturnPolicy,
  deliveryNote,  setDeliveryNote,
  tags,          setTags,
  keyFeatures,   setKeyFeatures,
  specifications,setSpecifications,
  whatsInBox,    setWhatsInBox,
  brands,
}) {
  return (
    <>
      <p className="ap-section-title">Product Information</p>

      {/* ── Name ── */}
      <div className="ap-field">
        <label className="ap-label">
          Product Name *
          <span className="ap-label-hint">Include brand, model, key spec</span>
        </label>
        <input
          type="text"
          className="ap-input"
          placeholder='e.g. "Samsung Galaxy A54 5G 128GB — Awesome Black"'
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <p className={`ap-char-count ${name.length > 70 ? "ap-char-count--warn" : ""}`}>
          {name.length}/80
        </p>
      </div>

      {/* ── Brand ── */}
      <div className="ap-field">
        <label className="ap-label">Brand</label>
        <select
          className="ap-select"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
        >
          <option value="">— No Brand / Generic —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.is_verified ? "✅ " : ""}{b.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Description ── */}
      <div className="ap-field">
        <label className="ap-label">Description</label>
        <textarea
          className="ap-textarea"
          placeholder="Describe the product clearly — key benefits, what makes it great, any important notes…"
          value={description}
          maxLength={1000}
          rows={5}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p
          className={`ap-char-count ${
            description.length > 900 ? "ap-char-count--warn" : ""
          }`}
        >
          {description.length}/1000
        </p>
      </div>

      {/* ── Key Features ── */}
      <div className="ap-field">
        <label className="ap-label">Key Features</label>
        <div className="ap-list-wrap">
          {keyFeatures.map((item, i) => (
            <div className="ap-list-row" key={i}>
              <input
                className="ap-mini-input"
                value={item}
                placeholder='e.g. "5000 mAh battery — lasts all day"'
                onChange={(e) => updateList(setKeyFeatures, i, e.target.value)}
              />
              <button
                type="button"
                className="ap-mini-remove"
                onClick={() => removeFromList(setKeyFeatures, i)}
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ap-add-btn"
            onClick={() => addToList(setKeyFeatures, keyFeatures, 10)}
          >
            <FiPlus size={13} /> Add Feature
          </button>
        </div>
      </div>

      {/* ── Specifications ── */}
      <div className="ap-field">
        <label className="ap-label">Technical Specifications</label>
        <div className="ap-list-wrap">
          {specifications.map((row, i) => (
            <div className="ap-spec-row" key={i}>
              <input
                className="ap-mini-input"
                value={row.key}
                placeholder="Property (e.g. Weight)"
                onChange={(e) => {
                  const next = [...specifications];
                  next[i] = { ...next[i], key: e.target.value };
                  setSpecifications(next);
                }}
              />
              <input
                className="ap-mini-input"
                value={row.value}
                placeholder="Value (e.g. 1.5 kg)"
                onChange={(e) => {
                  const next = [...specifications];
                  next[i] = { ...next[i], value: e.target.value };
                  setSpecifications(next);
                }}
              />
              <button
                type="button"
                className="ap-mini-remove"
                onClick={() => removeFromList(setSpecifications, i)}
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ap-add-btn"
            onClick={() =>
              setSpecifications((p) =>
                p.length < 20 ? [...p, { key: "", value: "" }] : p
              )
            }
          >
            <FiPlus size={13} /> Add Specification
          </button>
        </div>
      </div>

      {/* ── What's in the Box ── */}
      <div className="ap-field">
        <label className="ap-label">What's in the Box</label>
        <div className="ap-list-wrap">
          {whatsInBox.map((item, i) => (
            <div className="ap-list-row" key={i}>
              <input
                className="ap-mini-input"
                value={item}
                placeholder='e.g. "1× Phone, 1× USB-C Cable, 1× Adapter"'
                onChange={(e) => updateList(setWhatsInBox, i, e.target.value)}
              />
              <button
                type="button"
                className="ap-mini-remove"
                onClick={() => removeFromList(setWhatsInBox, i)}
              >
                <FiTrash2 size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ap-add-btn"
            onClick={() => addToList(setWhatsInBox, whatsInBox, 12)}
          >
            <FiPlus size={13} /> Add Item
          </button>
        </div>
      </div>

      {/* ── Warranty + Return Policy ── */}
      <div className="ap-field-row">
        <div className="ap-field">
          <label className="ap-label">Warranty</label>
          <input
            type="text"
            className="ap-input"
            placeholder='e.g. "12 months manufacturer warranty"'
            value={warranty}
            onChange={(e) => setWarranty(e.target.value)}
          />
        </div>
        <div className="ap-field">
          <label className="ap-label">Return Policy</label>
          <input
            type="text"
            className="ap-input"
            placeholder='e.g. "7-day returns accepted"'
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
          />
        </div>
      </div>

      {/* ── Delivery Note ── */}
      <div className="ap-field">
        <label className="ap-label">Delivery Note</label>
        <input
          type="text"
          className="ap-input"
          placeholder='e.g. "Ships within 24 hours via GIG Logistics"'
          value={deliveryNote}
          onChange={(e) => setDeliveryNote(e.target.value)}
        />
      </div>

      {/* ── Tags ── */}
      <div className="ap-field">
        <label className="ap-label">
          Tags
          <span className="ap-label-hint">
            Comma separated — boosts search visibility
          </span>
        </label>
        <input
          type="text"
          className="ap-input"
          placeholder='e.g. "samsung, android, 5G, smartphone"'
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>
    </>
  );
}