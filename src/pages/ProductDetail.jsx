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

        const images = data.images || [];
        setMainImage(images.length > 0 ? images[0] : "");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;
  if (!product) return null;

  const images = product.images || [];

  return (
    <div style={styles.container}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{product.title}</h2>
          <p style={styles.subText}>
            {product.category_name} • {product.subcategory_name}
          </p>
        </div>

        <div style={styles.actions}>
          <button
            onClick={() => navigate(`/seller/${product.seller_id}`)}
            style={styles.secondaryBtn}
          >
            View Seller
          </button>

          <button
            onClick={() =>
              navigate(`/conversations?userId=${product.seller_id}`)
            }
            style={styles.primaryBtn}
          >
            Chat Seller
          </button>
        </div>
      </div>

      {/* GRID */}
      <div style={styles.grid}>
        
        {/* IMAGE SECTION */}
        <div>
          {/* MAIN IMAGE */}
          <div style={styles.mainImageBox}>
            {mainImage ? (
              <img
                src={mainImage}
                alt="product"
                style={styles.mainImage}
                onError={(e) => {
                  e.target.src =
                    "https://via.placeholder.com/600x400?text=No+Image";
                }}
              />
            ) : (
              <div style={styles.noImage}>No Image Available</div>
            )}
          </div>

          {/* THUMBNAILS */}
          {images.length > 0 && (
            <div style={styles.thumbRow}>
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  onClick={() => setMainImage(img)}
                  onError={(e) => (e.target.style.display = "none")}
                  style={{
                    ...styles.thumb,
                    border:
                      mainImage === img
                        ? "2px solid #2563eb"
                        : "1px solid #ddd",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* DETAILS */}
        <div>
          <h2 style={styles.price}>
            ₦{Number(product.price).toLocaleString()}
          </h2>

          <div style={styles.section}>
            <h3>Description</h3>
            <p>{product.description || "No description provided"}</p>
          </div>

          <div style={styles.section}>
            <h3>Seller</h3>
            <p>{product.seller_name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  container: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottom: "1px solid #eee",
    paddingBottom: 10,
  },

  title: {
    margin: 0,
  },

  subText: {
    margin: 0,
    fontSize: 12,
    color: "#666",
  },

  actions: {
    display: "flex",
    gap: 10,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 30,
  },

  mainImageBox: {
    width: "100%",
    aspectRatio: "4 / 3",
    background: "#f5f5f5",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: "transform 0.3s ease",
  },

  thumbRow: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    overflowX: "auto",
  },

  thumb: {
    width: 70,
    height: 70,
    objectFit: "cover",
    borderRadius: 8,
    cursor: "pointer",
    transition: "0.2s",
  },

  price: {
    color: "green",
  },

  section: {
    marginTop: 20,
  },

  noImage: {
    color: "#999",
  },

  loading: {
    padding: 20,
  },

  error: {
    padding: 20,
    color: "red",
  },

  secondaryBtn: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ddd",
    background: "#f9f9f9",
    cursor: "pointer",
  },

  primaryBtn: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
};