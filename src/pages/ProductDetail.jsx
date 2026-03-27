import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");

  /* ================= FETCH ================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/product/${id}`);
        const json = await res.json();

        console.log("PRODUCT DATA:", json); // 🔥 DEBUG

        if (!json?.product) {
          throw new Error("Invalid response");
        }

        setData(json);
        setActiveImage(json.product.images?.[0] || "");
      } catch (err) {
        console.error("ERROR:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  /* ================= STATES ================= */
  if (loading) {
    return <div style={{ padding: 20 }}>Loading product...</div>;
  }

  if (!data || !data.product) {
    return <div style={{ padding: 20 }}>Product not found</div>;
  }

  const product = data.product;
  const related = data.related || [];
  const sellerProducts = data.sellerProducts || [];
  const rating = data.rating || { avg: 0, total: 0 };
  const seller = data.seller || {};

  const images = product.images || [];

  return (
    <>
      <TopNav />

      <div style={{ padding: 16 }}>

        {/* ================= IMAGE ================= */}
        <div>
          <img
            src={activeImage || "/placeholder.png"}
            style={{ width: "100%", maxHeight: 300, objectFit: "cover" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              onClick={() => setActiveImage(img)}
              style={{
                width: 60,
                height: 60,
                objectFit: "cover",
                cursor: "pointer",
                border: activeImage === img ? "2px solid black" : "none",
              }}
            />
          ))}
        </div>

        {/* ================= DETAILS ================= */}
        <h2>{product.title}</h2>

        <h3>₦{Number(product.price || 0).toLocaleString()}</h3>

        <p>⭐ {rating.avg} ({rating.total} reviews)</p>

        <p>{product.description || "No description"}</p>

        {/* ================= SELLER ================= */}
        <div style={{ marginTop: 20 }}>
          <h4>Seller</h4>
          <p>{seller.name || "Unknown"}</p>
          <p>{seller.followers || 0} followers</p>
        </div>

        {/* ================= RELATED ================= */}
        <h3 style={{ marginTop: 30 }}>Related</h3>

        <div style={{ display: "flex", overflowX: "auto", gap: 10 }}>
          {related.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{ minWidth: 140, cursor: "pointer" }}
            >
              <img
                src={p.images?.[0] || "/placeholder.png"}
                style={{ width: "100%" }}
              />
              <p>{p.title}</p>
            </div>
          ))}
        </div>

        {/* ================= SELLER PRODUCTS ================= */}
        <h3 style={{ marginTop: 30 }}>More from seller</h3>

        <div style={{ display: "flex", overflowX: "auto", gap: 10 }}>
          {sellerProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{ minWidth: 140, cursor: "pointer" }}
            >
              <img
                src={p.images?.[0] || "/placeholder.png"}
                style={{ width: "100%" }}
              />
              <p>{p.title}</p>
            </div>
          ))}
        </div>

      </div>

      <BottomNav />
    </>
  );
}