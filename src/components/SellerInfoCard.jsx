// src/components/SellerInfoCard.jsx
import React, { useState } from "react";
import { FaPhoneAlt, FaChevronDown, FaChevronUp, FaCopy } from "react-icons/fa";

export default function SellerInfoCard({ seller, product }) {
  const [open, setOpen] = useState(false);

  const copyNumber = () => {
    navigator.clipboard.writeText(seller.phone || "");
    alert("Number copied to clipboard!");
  };

  const handleCall = () => {
    if (seller.phone) window.location.href = `tel:${seller.phone}`;
  };

  return (
    <div style={{ background: "#f8f9fa", padding: 12, borderBottom: "1px solid #ccc" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div>
          <strong>{seller.name}</strong>
          {product?.createdAt && (
            <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>
              {new Date(product.createdAt.seconds * 1000).toLocaleString()} on Jiji, {seller.adsCount || 0} ads
            </span>
          )}
        </div>
        <div>{open ? <FaChevronUp /> : <FaChevronDown />}</div>
      </div>

      {open && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#212529" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{seller.phone}</span>
            <button
              onClick={handleCall}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#0D6EFD" }}
            >
              <FaPhoneAlt />
            </button>
            <button
              onClick={copyNumber}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#198754" }}
            >
              <FaCopy />
            </button>
          </div>

          <p style={{ marginTop: 6, color: "#dc3545", fontSize: 12 }}>
            ❗️ Never pay in advance! Even for the delivery
          </p>

          <p style={{ marginTop: 4, color: "#198754", fontSize: 12 }}>
            ✅ Inform the seller you got their number on Jiji so they know where you came from
          </p>
        </div>
      )}
    </div>
  );
}