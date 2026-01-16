// src/components/ChatProductPreview.jsx
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ChatProductPreview({ productId }) {
  const [product, setProduct] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      const docSnap = await getDoc(doc(db, "products", productId));
      if (docSnap.exists()) setProduct({ id: docSnap.id, ...docSnap.data() });
    };
    loadProduct();
  }, [productId]);

  if (!product) return null;

  const toggleOpen = () => setOpen((prev) => !prev);

  const markSold = async () => {
    await updateDoc(doc(db, "products", productId), { sold: true });
    setProduct((prev) => ({ ...prev, sold: true }));
    alert("Product marked as sold ✅");
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(product.phoneNumber);
    alert("Number copied to clipboard ✅");
  };

  const callNumber = () => {
    window.open(`tel:${product.phoneNumber}`);
  };

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, margin: "10px 0", overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={toggleOpen}
        style={{
          background: "#0D6EFD",
          color: "#fff",
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <div>
          <strong>{product.ownerName}</strong>
          {product.sold && <span style={{ marginLeft: 10, color: "#dc3545" }}>SOLD</span>}
        </div>
        <div>{open ? "▲" : "▼"}</div>
      </div>

      {/* Dropdown Content */}
      {open && (
        <div style={{ background: "#f8f9fa", padding: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>{product.name}</p>
              <p style={{ margin: "2px 0", fontSize: 14 }}>₦{product.price.toLocaleString()}</p>
              <p style={{ margin: "2px 0", fontSize: 12, color: "#555" }}>{product.description}</p>
              <p style={{ fontSize: 12, color: "#555" }}>
                Listed: {new Date(product.createdAt?.seconds * 1000).toLocaleString()} | {product.adsCount} ads
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {product.phoneNumber && (
              <>
                <button
                  onClick={callNumber}
                  style={{ padding: "6px 10px", background: "#198754", color: "#fff", border: "none", borderRadius: 5 }}
                >
                  📞 Call
                </button>
                <button
                  onClick={copyNumber}
                  style={{ padding: "6px 10px", background: "#6c757d", color: "#fff", border: "none", borderRadius: 5 }}
                >
                  Copy Number
                </button>
              </>
            )}
            {!product.sold && (
              <button
                onClick={markSold}
                style={{ padding: "6px 10px", background: "#dc3545", color: "#fff", border: "none", borderRadius: 5 }}
              >
                Mark Sold
              </button>
            )}
          </div>

          {/* Warning & info */}
          <p style={{ fontSize: 12, color: "#dc3545", marginTop: 8 }}>
            ❗ Never pay in advance! Even for delivery
          </p>
          <p style={{ fontSize: 12, color: "#198754" }}>
            ✅ Inform the seller you got their number on Jiji
          </p>
        </div>
      )}
    </div>
  );
}