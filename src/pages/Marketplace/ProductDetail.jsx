import {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/* =====================================================
   ENTERPRISE PRODUCT DETAIL PAGE
===================================================== */

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState(false);

  /* ==============================
     FETCH PRODUCT + SIMILAR
  =============================== */
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/marketplace/${id}`);
        const data = await res.json();

        if (!res.ok) throw new Error("Failed");

        if (mounted) {
          setProduct(data);
          setSelectedImage(data.images?.[0] || "");

          // Increment view count
          fetch(`/api/marketplace/${id}/view`, { method: "POST" });

          // Fetch similar products
          const sim = await fetch(
            `/api/marketplace?category=${data.category}&limit=4`
          );
          const simData = await sim.json();
          setSimilarProducts(simData.products || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => (mounted = false);
  }, [id]);

  /* ==============================
     PERFORMANCE MEMOIZATION
  =============================== */
  const formattedPrice = useMemo(() => {
    if (!product?.price) return "";
    return `₦${Number(product.price).toLocaleString()}`;
  }, [product]);

  const structuredData = useMemo(() => {
    if (!product) return null;

    return {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: product.title,
      image: product.images,
      description: product.description,
      brand: product.brand,
      offers: {
        "@type": "Offer",
        priceCurrency: "NGN",
        price: product.price,
        availability: "https://schema.org/InStock",
      },
    };
  }, [product]);

  const toggleWishlist = useCallback(() => {
    setWishlist((prev) => !prev);
  }, []);

  if (loading) return <div style={{ padding: 50 }}>Loading...</div>;
  if (!product) return <div>Product not found</div>;

  return (
    <>
      {/* ================= SEO ================= */}
      <Helmet>
        <title>{product.title} | Marketplace</title>
        <meta name="description" content={product.description?.slice(0, 160)} />
        <meta property="og:title" content={product.title} />
        <meta property="og:image" content={product.images?.[0]} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* ================= BREADCRUMB ================= */}
      <div style={{ maxWidth: 1200, margin: "20px auto" }}>
        <Link to="/">Home</Link> ›{" "}
        <Link to="/marketplace">Marketplace</Link> ›{" "}
        <span>{product.title}</span>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "30px auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 40,
        }}
      >
        {/* ================= IMAGE ================= */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div
            style={{
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid #eee",
            }}
          >
            <img
              src={selectedImage}
              alt={product.title}
              style={{
                width: "100%",
                height: 450,
                objectFit: "cover",
                transition: "transform 0.3s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "scale(1.1)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            />
          </div>

          {/* Thumbnails */}
          <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
            {product.images?.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="thumb"
                onClick={() => setSelectedImage(img)}
                style={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  cursor: "pointer",
                  borderRadius: 8,
                  border:
                    selectedImage === img
                      ? "2px solid #007BFF"
                      : "1px solid #ddd",
                }}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <h1>{product.title}</h1>

          {product.promoted && (
            <span style={{ background: "gold", padding: 5 }}>
              ⭐ Sponsored
            </span>
          )}

          <h2 style={{ marginTop: 20 }}>{formattedPrice}</h2>

          <p style={{ marginTop: 20 }}>{product.description}</p>

          {/* ACTION BUTTONS */}
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button onClick={toggleWishlist}>
              {wishlist ? "❤️ Saved" : "🤍 Save"}
            </button>

            <a href={`tel:${product.phone_number}`}>
              <button>📞 Call</button>
            </a>

            <Link to={`/chat/${product.seller_id}`}>
              <button>💬 Chat</button>
            </Link>
          </div>

          {/* VIEW COUNT */}
          <p style={{ marginTop: 15 }}>
            👁 {product.views || 0} views
          </p>

          {/* SELLER */}
          <div
            style={{
              marginTop: 30,
              padding: 20,
              border: "1px solid #eee",
              borderRadius: 10,
            }}
          >
            <h3>Seller Information</h3>
            <p>{product.poster_name}</p>
            <Link to={`/seller/${product.seller_id}`}>
              View Seller Profile
            </Link>
          </div>

          {/* REVIEWS SECTION */}
          <div style={{ marginTop: 40 }}>
            <h3>Reviews</h3>
            <p>⭐ {product.rating || 4.5} / 5</p>

            {product.reviews?.map((r, i) => (
              <div key={i} style={{ marginBottom: 15 }}>
                <strong>{r.user}</strong>
                <p>{r.comment}</p>
              </div>
            ))}

            <textarea placeholder="Write a review..." />
            <button style={{ marginTop: 10 }}>Submit Review</button>
          </div>
        </div>
      </div>

      {/* ================= SIMILAR PRODUCTS ================= */}
      <div style={{ maxWidth: 1200, margin: "60px auto" }}>
        <h2>Similar Products</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
            gap: 20,
            marginTop: 20,
          }}
        >
          {similarProducts.map((p) => (
            <Link
              key={p._id}
              to={`/marketplace/${p._id}`}
              style={{ textDecoration: "none", color: "black" }}
            >
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <img
                  src={p.images?.[0]}
                  alt={p.title}
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit: "cover",
                  }}
                />
                <h4>{p.title}</h4>
                <p>₦{Number(p.price).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}