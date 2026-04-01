import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/product/${id}`);
        const data = res.data.product;

        setProduct(data);

        // ✅ SET FIRST IMAGE AS MAIN
        if (data.images && data.images.length > 0) {
          setMainImage(data.images[0]);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  if (!product) return null;

  const images = product.images || [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      
      {/* 🔷 HEADER */}
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>{product.title}</h2>
          <p style={subText}>
            {product.category_name} • {product.subcategory_name}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate(`/seller/${product.seller_id}`)}
            style={btnStyle}
          >
            View Seller
          </button>

          <button
            onClick={() =>
              navigate(`/conversations?userId=${product.seller_id}`)
            }
            style={primaryBtn}
          >
            Chat Seller
          </button>
        </div>
      </div>

      {/* 🔥 IMAGE + DETAILS GRID */}
      <div style={grid}>
        
        {/* IMAGE SECTION */}
        <div>
          {/* MAIN IMAGE */}
          <div style={mainImageBox}>
            {mainImage ? (
              <img
                src={mainImage}
                alt=""
                style={mainImageStyle}
                onError={(e) => (e.target.style.display = "none")}
              />
            ) : (
              <div style={noImage}>No Image</div>
            )}
          </div>

          {/* THUMBNAILS */}
          <div style={thumbRow}>
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                onClick={() => setMainImage(img)}
                style={{
                  ...thumb,
                  border:
                    mainImage === img
                      ? "2px solid #2563eb"
                      : "1px solid #ddd",
                }}
              />
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div>
          <h2 style={{ color: "green" }}>
            ₦{Number(product.price).toLocaleString()}
          </h2>

          <div style={{ marginTop: 20 }}>
            <h3>Description</h3>
            <p>{product.description || "No description"}</p>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3>Seller</h3>
            <p>{product.seller_name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  borderBottom: "1px solid #eee",
  paddingBottom: 10,
};

const subText = {
  margin: 0,
  fontSize: 12,
  color: "#666",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 30,
};

const mainImageBox = {
  width: "100%",
  height: 350,
  background: "#f5f5f5",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const mainImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "contain", // 🔥 prevents full/stretch issue
};

const noImage = {
  color: "#999",
};

const thumbRow = {
  display: "flex",
  gap: 10,
  marginTop: 10,
  overflowX: "auto",
};

const thumb = {
  width: 70,
  height: 70,
  objectFit: "cover",
  borderRadius: 6,
  cursor: "pointer",
};

const btnStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ddd",
  cursor: "pointer",
  background: "#f9f9f9",
};

const primaryBtn = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
};