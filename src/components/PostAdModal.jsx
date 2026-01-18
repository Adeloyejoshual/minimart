// src/components/PostAdModal.jsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

export default function PostAdModal() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const handlePostAd = (market = "marketplace") => {
    closeModal();
    navigate(`/add-product?market=${market}`);
  };

  if (!isOpen) {
    return (
      <button
        onClick={openModal}
        style={{
          padding: "10px 16px",
          background: "#0D6EFD",
          color: "#fff",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
        }}
      >
        Post an Ad
      </button>
    );
  }

  return createPortal(
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <h2 style={{ marginTop: 0 }}>Choose Market</h2>
        <p>Select where you want to post your product:</p>
        <div style={{ display: "flex", gap: 15, marginTop: 20 }}>
          <button
            style={{ ...btnStyles, background: "#0D6EFD" }}
            onClick={() => handlePostAd("marketplace")}
          >
            Marketplace
          </button>
          <button
            style={{ ...btnStyles, background: "#198754" }}
            onClick={() => handlePostAd("minimart")}
          >
            MiniMart (Verified)
          </button>
        </div>
        <button onClick={closeModal} style={closeBtnStyles}>×</button>
      </div>
    </div>,
    document.body
  );
}

// ----- Styles -----
const overlayStyles = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyles = {
  position: "relative",
  background: "#fff",
  padding: 30,
  borderRadius: 12,
  width: 320,
  textAlign: "center",
  boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
};

const btnStyles = {
  flex: 1,
  padding: "10px 0",
  color: "#fff",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};

const closeBtnStyles = {
  position: "absolute",
  top: 10,
  right: 10,
  background: "transparent",
  border: "none",
  fontSize: 20,
  cursor: "pointer",
};