// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/ContactSupport.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/contact-support.css";

import { useState, useRef } from "react";
import { Link }             from "react-router-dom";
import axios                from "axios";
import toast                from "react-hot-toast";
import {
  IconArrowLeft,
  IconChevronDown,
  IconUpload,
  IconX,
  IconCheckCircle,
  IconAlertCircle,
  IconLoader,
  IconTicket,
} from "../../components/help/icons/HelpIcons";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL;

const CATEGORIES = [
  "Account", "Buying", "Selling", "Payments", "Delivery",
  "Wallet", "Subscriptions", "Promotions & Coupons",
  "Safety & Security", "Returns & Refunds",
  "Policies", "Technical Issues", "Other",
];

const PRIORITIES = [
  { value: "low",    label: "Low",    description: "General inquiry, non-urgent",   variant: "priority-select-low" },
  { value: "medium", label: "Medium", description: "Affecting my experience",       variant: "priority-select-medium" },
  { value: "high",   label: "High",   description: "Urgent, significant impact",    variant: "priority-select-high" },
];

export default function ContactSupport({ user }) {
  const fileRef = useRef(null);

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(null);
  const [error,    setError]    = useState("");
  const [files,    setFiles]    = useState([]);
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    const valid    = newFiles.filter((f) => f.size <= 10 * 1024 * 1024);
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    formData.set("priority", priority);

    try {
      const token = localStorage.getItem("marketplace_token");
      const res   = await axios.post(`${BASE_URL}/api/support/tickets`, {
        category:    formData.get("category"),
        subject:     formData.get("subject"),
        description: formData.get("description"),
        priority,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess({
        ticketNumber: res.data.ticket_number || "TKT-" + Date.now(),
        ticketId:     res.data.id || "new",
      });
      toast.success("Support ticket submitted");
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Success ──
  if (success) {
    return (
      <div className="contact-success-wrapper">
        <div className="contact-success-card">
          <div className="contact-success-icon-wrapper">
            <IconCheckCircle size={40} className="contact-success-icon" />
          </div>
          <h2 className="contact-success-title">Ticket Submitted</h2>
          <p className="contact-success-description">
            Your support request has been received. Our team will respond shortly.
          </p>
          <div className="contact-success-ticket-box">
            <div className="contact-success-ticket-number">
              <IconTicket size={20} />
              <span>{success.ticketNumber}</span>
            </div>
            <p className="contact-success-ticket-hint">
              Save this ticket number for reference
            </p>
          </div>
          <div className="contact-success-actions">
            <Link to="/support/tickets" className="contact-success-btn-primary">
              View Tickets
            </Link>
            <Link to="/help" className="contact-success-btn-outline">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-support-page">
      <div className="contact-support-container">
        <div className="contact-header">
          <Link to="/support" className="contact-back-link">
            <IconArrowLeft size={20} />
          </Link>
          <div className="contact-header-text">
            <h1 className="contact-title">Contact Support</h1>
            <p className="contact-subtitle">Fill in the details and we will get back to you</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          {/* Category */}
          <div className="contact-section">
            <h3 className="contact-section-title">What do you need help with?</h3>
            <div className="contact-select-wrapper">
              <select
                name="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="contact-select"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <IconChevronDown size={20} className="contact-select-chevron" />
            </div>
          </div>

          {/* Subject & Description */}
          <div className="contact-section">
            <h3 className="contact-section-title">Describe your issue</h3>
            <div className="contact-field">
              <label className="contact-label">
                Subject <span className="contact-required">*</span>
              </label>
              <input
                type="text"
                name="subject"
                required
                placeholder="Brief summary of your issue"
                className="contact-input"
              />
            </div>
            <div className="contact-field">
              <label className="contact-label">
                Description <span className="contact-required">*</span>
              </label>
              <textarea
                name="description"
                required
                rows={6}
                placeholder="Please provide as much detail as possible..."
                className="contact-textarea"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="contact-section">
            <h3 className="contact-section-title">Priority Level</h3>
            <div className="contact-priority-grid">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`contact-priority-option ${p.variant} ${
                    priority === p.value ? "contact-priority-selected" : ""
                  }`}
                >
                  <span className="contact-priority-label">{p.label}</span>
                  <span className="contact-priority-desc">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="contact-section">
            <h3 className="contact-section-title">Attachments</h3>
            <p className="contact-section-hint">
              Upload screenshots or documents (max 5 files, 10MB each)
            </p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="contact-file-input-hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="contact-upload-zone"
            >
              <IconUpload size={24} className="contact-upload-icon" />
              <p className="contact-upload-text">Click to upload files</p>
              <p className="contact-upload-hint">PNG, JPG, PDF, DOC up to 10MB</p>
            </button>

            {files.length > 0 && (
              <div className="contact-file-list">
                {files.map((file, index) => (
                  <div key={index} className="contact-file-item">
                    <div className="contact-file-info">
                      <div className="contact-file-icon-wrapper">
                        <IconUpload size={16} />
                      </div>
                      <div className="contact-file-details">
                        <p className="contact-file-name">{file.name}</p>
                        <p className="contact-file-size">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="contact-file-remove"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="contact-error">
              <IconAlertCircle size={20} className="contact-error-icon" />
              <p className="contact-error-text">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="contact-submit-btn">
            {loading ? (
              <>
                <IconLoader size={20} className="contact-spinner" />
                Submitting...
              </>
            ) : (
              "Submit Support Request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}