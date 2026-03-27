import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch(`/api/product/${id}`)
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setActiveImage(res.product?.images?.[0] || "");
      });
  }, [id]);

  if (!data) {
    return (
      <>
        <TopNav />
        <div className="p-6 text-center">Loading...</div>
        <BottomNav />
      </>
    );
  }

  const { product, related, sellerProducts, rating, seller } = data;

  const images = product.images || [];

  /* ================= FOLLOW ================= */
  const [following, setFollowing] = useState(false);

  const toggleFollow = async () => {
    const method = following ? "DELETE" : "POST";

    await fetch(`/api/product/seller/${seller.id}/follow`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "demo-user" }), // replace with real user
    });

    setFollowing(!following);
  };

  /* ================= IMAGE ZOOM ================= */
  const handleZoom = () => {
    setZoom((z) => (z === 1 ? 2 : 1));
  };

  return (
    <>
      <TopNav />

      <div className="product-page">

        {/* ================= IMAGE SECTION ================= */}
        <div className="image-section">

          <div
            className="main-image"
            onClick={() => setViewerOpen(true)}
            onDoubleClick={handleZoom}
          >
            <img
              src={activeImage}
              style={{ transform: `scale(${zoom})` }}
              alt=""
            />
          </div>

          {/* THUMBNAILS */}
          <div className="thumb-row">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div className="details">

          <h1>{product.title}</h1>

          <div className="price">
            ₦{Number(product.price).toLocaleString()}
          </div>

          {/* ⭐ RATING */}
          <div className="rating">
            ⭐ {rating?.avg || 0} ({rating?.total || 0} reviews)
          </div>

          <p className="desc">{product.description}</p>

          {/* ================= SELLER ================= */}
          <div className="seller-box">
            <div className="seller-info">
              <img
                src={seller.avatar || "/avatar.png"}
                className="seller-avatar"
              />
              <div>
                <strong>{seller.name}</strong>
                <p>{seller.followers} followers</p>
              </div>
            </div>

            <button onClick={toggleFollow}>
              {following ? "Following" : "Follow"}
            </button>
          </div>

        </div>
      </div>

      {/* ================= RELATED ================= */}
      <div className="section">
        <h2>Related Products</h2>

        <div className="horizontal-scroll">
          {related.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="card"
            >
              <img src={p.images?.[0]} />
              <p>{p.title}</p>
              <strong>₦{p.price}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* ================= SELLER PRODUCTS ================= */}
      <div className="section">
        <h2>More from this seller</h2>

        <div className="horizontal-scroll">
          {sellerProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="card"
            >
              <img src={p.images?.[0]} />
              <p>{p.title}</p>
              <strong>₦{p.price}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* ================= FULLSCREEN VIEWER ================= */}
      {viewerOpen && (
        <div className="viewer" onClick={() => setViewerOpen(false)}>
          <img src={activeImage} className="viewer-img" />
        </div>
      )}

      <BottomNav />
    </>
  );
}