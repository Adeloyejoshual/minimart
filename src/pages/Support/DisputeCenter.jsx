// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/DisputeCenter.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/dispute-center.css";

import { useState }  from "react";
import { Link }      from "react-router-dom";
import axios         from "axios";
import toast         from "react-hot-toast";
import {
  IconScale, IconCheckCircle, IconArrowLeft, IconAlertTriangle,
  IconLoader, IconClock, IconTruck, IconCreditCard,
  IconShoppingCart, IconHelpCircle,
} from "../../components/help/icons/HelpIcons";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const DISPUTE_TYPES = [
  { value: "wrong_item",       label: "Wrong Item Received", icon: IconShoppingCart },
  { value: "item_not_received",label: "Item Not Received",   icon: IconTruck },
  { value: "damaged_item",     label: "Damaged Item",        icon: IconAlertTriangle },
  { value: "refund_request",   label: "Refund Request",      icon: IconCreditCard },
  { value: "delivery_dispute", label: "Delivery Dispute",    icon: IconTruck },
  { value: "other",            label: "Other Issue",         icon: IconHelpCircle },
];

export default function DisputeCenter({ user }) {
  const [showForm,    setShowForm]    = useState(false);
  const [disputeType, setDisputeType] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState("");
  const [error,       setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData(e.target);
    try {
      const token = localStorage.getItem("marketplace_token");
      const res   = await axios.post(`${BASE_URL}/api/support/disputes`, {
        dispute_type: fd.get("dispute_type"),
        order_id:     fd.get("order_id"),
        seller_id:    fd.get("seller_id"),
        subject:      fd.get("subject"),
        description:  fd.get("description"),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(`Dispute ${res.data.dispute_number || "DSP-" + Date.now()} filed. We will review within 48 hours.`);
      toast.success("Dispute filed");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit dispute.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="dispute-success-wrapper">
        <div className="dispute-success-card">
          <div className="dispute-success-icon-wrapper">
            <IconCheckCircle size={40} className="dispute-success-icon" />
          </div>
          <h2 className="dispute-success-title">Dispute Filed</h2>
          <p className="dispute-success-text">{success}</p>
          <div className="dispute-success-info"><IconClock size={16} /><span>Both parties have 14 days to resolve</span></div>
          <Link to="/help" className="dispute-success-btn">Back to Help Center</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dispute-center-page">
      <div className="dispute-center-container">
        <div className="dispute-header">
          <Link to="/support" className="dispute-back-link"><IconArrowLeft size={20} /></Link>
          <div>
            <h1 className="dispute-title">Dispute Center</h1>
            <p className="dispute-subtitle">Resolve buyer-seller disagreements</p>
          </div>
        </div>

        {!showForm ? (
          <>
            <div className="dispute-info-banner">
              <IconAlertTriangle size={20} className="dispute-info-icon" />
              <div>
                <p className="dispute-info-title">Before filing a dispute</p>
                <p className="dispute-info-text">Please try contacting the seller directly first.</p>
              </div>
            </div>
            <div className="dispute-types-section">
              <h3 className="dispute-types-title">Common Dispute Types</h3>
              <div className="dispute-types-list">
                {DISPUTE_TYPES.map(({ value, label, icon: Icon }) => (
                  <div key={value} className="dispute-type-info-item">
                    <div className="dispute-type-info-icon"><Icon size={20} /></div>
                    <span className="dispute-type-info-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowForm(true)} className="dispute-file-btn">
              <IconScale size={20} /> File a Dispute
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="dispute-form">
            <div className="dispute-form-section">
              <h3 className="dispute-form-section-title">Dispute Type</h3>
              <div className="dispute-type-grid">
                {DISPUTE_TYPES.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setDisputeType(value)}
                    className={`dispute-type-card ${disputeType === value ? "dispute-type-selected" : ""}`}>
                    <div className="dispute-type-card-icon"><Icon size={22} /></div>
                    <p className="dispute-type-card-label">{label}</p>
                  </button>
                ))}
              </div>
              <input type="hidden" name="dispute_type" value={disputeType} />
            </div>

            {disputeType && (
              <div className="dispute-form-section">
                <div className="dispute-field">
                  <label className="dispute-label">Order ID <span className="dispute-required">*</span></label>
                  <input type="text" name="order_id" required placeholder="Enter order ID" className="dispute-input" />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">Seller ID <span className="dispute-required">*</span></label>
                  <input type="text" name="seller_id" required placeholder="Enter seller ID" className="dispute-input" />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">Subject <span className="dispute-required">*</span></label>
                  <input type="text" name="subject" required placeholder="Brief summary" className="dispute-input" />
                </div>
                <div className="dispute-field">
                  <label className="dispute-label">Description <span className="dispute-required">*</span></label>
                  <textarea name="description" required rows={5} placeholder="Describe the issue..." className="dispute-textarea" />
                </div>
              </div>
            )}

            {error && <div className="dispute-error"><IconAlertTriangle size={16} /><span>{error}</span></div>}

            <div className="dispute-form-actions">
              <button type="button" onClick={() => setShowForm(false)} className="dispute-cancel-btn">Back</button>
              <button type="submit" disabled={loading || !disputeType} className="dispute-submit-btn">
                {loading ? <IconLoader size={16} className="dispute-spinner" /> : <IconScale size={16} />}
                {loading ? "Submitting..." : "File Dispute"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}