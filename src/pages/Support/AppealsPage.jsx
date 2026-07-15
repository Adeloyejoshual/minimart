// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/AppealsPage.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/appeals.css";

import { useState }  from "react";
import { Link }      from "react-router-dom";
import axios         from "axios";
import toast         from "react-hot-toast";
import {
  IconArrowLeft, IconCheckCircle, IconAlertTriangle,
  IconLoader, IconMegaphone, IconLock, IconTag,
  IconAlertCircle, IconHelpCircle,
} from "../../components/help/icons/HelpIcons";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const APPEAL_TYPES = [
  { value: "suspended_account",  label: "Suspended Account",  description: "Your account has been suspended",        icon: IconLock },
  { value: "removed_listing",    label: "Removed Listing",    description: "A listing was removed incorrectly",      icon: IconTag },
  { value: "rejected_listing",   label: "Rejected Listing",   description: "Your listing was rejected during review", icon: IconAlertCircle },
  { value: "enforcement_action", label: "Enforcement Action", description: "A warning was placed on your account",    icon: IconAlertTriangle },
  { value: "other",              label: "Other",              description: "Something else not covered above",         icon: IconHelpCircle },
];

export default function AppealsPage({ user }) {
  const [selectedType, setSelectedType] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState("");
  const [error,        setError]        = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const fd = new FormData(e.target);
    try {
      const token = localStorage.getItem("marketplace_token");
      const res   = await axios.post(`${BASE_URL}/api/support/appeals`, {
        appeal_type:  fd.get("appeal_type"),
        subject:      fd.get("subject"),
        description:  fd.get("description"),
        reference_id: fd.get("reference_id") || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(`Appeal ${res.data.appeal_number || "APL-" + Date.now()} submitted.`);
      toast.success("Appeal submitted");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit appeal.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="appeal-success-wrapper">
        <div className="appeal-success-card">
          <div className="appeal-success-icon-wrapper">
            <IconCheckCircle size={40} className="appeal-success-icon" />
          </div>
          <h2 className="appeal-success-title">Appeal Submitted</h2>
          <p className="appeal-success-text">{success}</p>
          <p className="appeal-success-hint">Our team will respond within 3 to 5 business days.</p>
          <Link to="/help" className="appeal-success-btn">Back to Help Center</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="appeals-page">
      <div className="appeals-container">
        <div className="appeals-header">
          <Link to="/support" className="appeals-back-link"><IconArrowLeft size={20} /></Link>
          <div>
            <h1 className="appeals-title">Submit an Appeal</h1>
            <p className="appeals-subtitle">Challenge a decision made on your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="appeals-form">
          <input type="hidden" name="appeal_type" value={selectedType} />
          <div className="appeals-type-section">
            <h3 className="appeals-type-title">What would you like to appeal?</h3>
            <div className="appeals-type-list">
              {APPEAL_TYPES.map(({ value, label, description, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setSelectedType(value)}
                  className={`appeals-type-card ${selectedType === value ? "appeals-type-selected" : ""}`}>
                  <div className="appeals-type-card-icon"><Icon size={22} /></div>
                  <div className="appeals-type-card-text">
                    <p className="appeals-type-card-label">{label}</p>
                    <p className="appeals-type-card-desc">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <>
              <div className="appeals-form-section">
                <div className="appeals-field">
                  <label className="appeals-label">Reference ID <span className="appeals-optional">(optional)</span></label>
                  <input type="text" name="reference_id" placeholder="Optional reference" className="appeals-input" />
                </div>
                <div className="appeals-field">
                  <label className="appeals-label">Subject <span className="appeals-required">*</span></label>
                  <input type="text" name="subject" required placeholder="Brief summary" className="appeals-input" />
                </div>
                <div className="appeals-field">
                  <label className="appeals-label">Explanation <span className="appeals-required">*</span></label>
                  <textarea name="description" required rows={6} placeholder="Explain why this decision was incorrect..." className="appeals-textarea" />
                </div>
              </div>

              {error && <div className="appeals-error"><IconAlertTriangle size={16} /><span>{error}</span></div>}

              <button type="submit" disabled={loading} className="appeals-submit-btn">
                {loading ? <IconLoader size={20} className="appeals-spinner" /> : <IconMegaphone size={20} />}
                {loading ? "Submitting..." : "Submit Appeal"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}