// src/pages/Marketplace/MarketplaceProductDetail.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  FaPhone, FaMapMarkerAlt, FaStar, FaHeart, FaShippingFast, 
  FaFire, FaUserCheck, FaClock, FaExchangeAlt 
} from "react-icons/fa";

export default function MarketplaceProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  /* =========================
     FETCH PRODUCT
  ========================== */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/marketplace/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load product");
        }

        setProduct(data);
        setSelectedImage(data.images?.[0] || "");
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  /* =========================
     FETCH SIMILAR PRODUCTS
  ========================== */
  useEffect(() => {
    if (product?.category) {
      const fetchSimilar = async () => {
        setLoadingSimilar(true);
        try {
          const res = await fetch(`/api/marketplace?category=${product.category}&limit=6&exclude=${id}`);
          const data = await res.json();
          setSimilarProducts(data.slice(0, 6));
        } catch (error) {
          console.error("Similar products error:", error);
        } finally {
          setLoadingSimilar(false);
        }
      };
      fetchSimilar();
    }
  }, [product?.category, id]);

  if (loading) {
    return <PremiumLoading />;
  }

  if (!product) {
    return <NotFound />;
  }

  const discountPercent = product.discount_price 
    ? Math.round(((parseFloat(product.price) - parseFloat(product.discount_price)) / parseFloat(product.price)) * 100)
    : 0;

  return (
    <div style={pageContainer}>
      
      {/* BREADCRUMB */}
      <div style={breadcrumb}>
        <Link to="/marketplace" style={breadcrumbLink}>Marketplace</Link>
        <span style={breadcrumbSep}>/</span>
        <Link to={`/marketplace/${product.category}`} style={breadcrumbLink}>{product.category}</Link>
        <span style={breadcrumbSep}>/</span>
        <span style={breadcrumbCurrent}>{product.title.substring(0, 40)}...</span>
      </div>

      {/* HEADER */}
      <div style={headerSection}>
        <h1 style={titleStyle}>{product.title}</h1>
        
        <div style={headerBadges}>
          {product.promoted && (
            <span style={promotedBadge}>🔥 SPONSORED</span>
          )}
          {discountPercent > 0 && (
            <span style={discountBadge}>{discountPercent}% OFF</span>
          )}
          <span style={conditionBadge}>{product.condition || 'New'}</span>
        </div>
      </div>

      {/* MAIN SECTION */}
      <div style={mainGrid}>
        
        {/* PREMIUM IMAGE GALLERY */}
        <div style={gallerySection}>
          <div style={mainImageContainer}>
            <img
              src={selectedImage}
              alt="Product"
              style={mainImage}
            />
            {product.video_link && (
              <a href={product.video_link} target="_blank" style={videoOverlay}>
                ▶️ Watch Video
              </a>
            )}
          </div>

          <div style={thumbnailsContainer}>
            {product.images?.map((img, index) => (
              <div
                key={index}
                style={thumbnailWrapper(selectedImage === img)}
                onClick={() => setSelectedImage(img)}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${index + 1}`}
                  style={thumbnailImg}
                />
              </div>
            ))}
          </div>
        </div>

        {/* PREMIUM DETAILS */}
        <div style={detailsSection}>
          
          {/* PRICE */}
          <div style={priceHero}>
            <div style={oldPrice(discountPercent > 0)}>
              ₦{Number(product.price).toLocaleString()}
            </div>
            <div style={newPrice}>
              ₦{Number(product.discount_price || product.price).toLocaleString()}
            </div>
          </div>

          {/* SELLER */}
          <div style={sellerCard}>
            <div style={sellerHeader}>
              <FaUserCheck style={sellerIcon} />
              <div>
                <div style={sellerName}>{product.poster_name}</div>
                <div style={sellerRating}>⭐ 4.9 (127 reviews)</div>
              </div>
            </div>
            <div style={sellerContact}>
              <a href={`tel:${product.phone_number}`} style={callButton}>
                <FaPhone style={phoneIcon} /> Call Seller
              </a>
            </div>
          </div>

          {/* QUICK INFO */}
          <div style={quickStats}>
            <StatItem icon={FaStar} label={product.condition || 'New'} />
            {product.brand && <StatItem label={`${product.brand} ${product.model || ''}`} />}
            <StatItem icon={FaShippingFast} label="Free Delivery Available" />
          </div>

          {/* CTA */}
          <div style={ctaSection}>
            <a href={`tel:${product.phone_number}`} style={primaryCTA}>📞 Contact Seller Now</a>
            <button style={secondaryCTA}>♡ Add to Wishlist</button>
          </div>

          {product.negotiable && (
            <div style={negotiableBanner}>💬 Price Negotiable</div>
          )}
        </div>
      </div>

      {/* PREMIUM TABS */}
      <div style={tabsSection}>
        <div style={tabHeaders}>
          <button 
            style={tabButtonStyle(activeTab === 'details')}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button 
            style={tabButtonStyle(activeTab === 'delivery')}
            onClick={() => setActiveTab('delivery')}
          >
            Delivery
          </button>
          {product.features?.length > 0 && (
            <button 
              style={tabButtonStyle(activeTab === 'specs')}
              onClick={() => setActiveTab('specs')}
            >
              Specs
            </button>
          )}
        </div>

        <div style={tabContent}>
          {activeTab === 'details' && (
            <div style={tabPanel}>
              <p style={descriptionStyle}>{product.description}</p>
            </div>
          )}
          
          {activeTab === 'delivery' && product.deliveryRegions?.length > 0 && (
            <div style={deliveryGrid}>
              {product.deliveryRegions.map((region, index) => (
                <DeliveryCard key={index} region={region} />
              ))}
            </div>
          )}

          {activeTab === 'specs' && (
            <div style={specsGrid}>
              {product.ram && <SpecItem label="RAM" value={product.ram} />}
              {product.storage && <SpecItem label="Storage" value={product.storage} />}
              {product.color && <SpecItem label="Color" value={product.color} />}
              {product.year && <SpecItem label="Year" value={product.year} />}
              {product.features?.length > 0 && (
                <SpecItem label="Features" value={product.features.join(', ')} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* SIMILAR PRODUCTS */}
      <div style={similarSection}>
        <div style={sectionHeader}>
          <h2 style={sectionTitle}>Similar Products</h2>
          <Link to={`/marketplace/${product.category}`} style={viewAllLink}>
            View All →
          </Link>
        </div>
        
        {loadingSimilar ? (
          <div style={loadingRow}>Loading similar products...</div>
        ) : (
          <div style={similarGrid}>
            {similarProducts.map((item) => (
              <SimilarCard key={item.id} product={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ================ COMPONENTS ================
const PremiumLoading = () => (
  <div style={loadingContainer}>
    <div style={spinnerStyle} />
    <div style={loadingText}>Loading Premium Details</div>
  </div>
);

const NotFound = () => (
  <div style={notFoundContainer}>
    <h2>Product not found</h2>
    <Link to="/marketplace" style={backLink}>← Back to Marketplace</Link>
  </div>
);

const StatItem = ({ icon: Icon, label }) => (
  <div style={statItem}>
    {Icon && <Icon style={statIcon} />}
    <span>{label}</span>
  </div>
);

const DeliveryCard = ({ region }) => (
  <div style={deliveryCard}>
    <div style={deliveryHeader}>
      <FaMapMarkerAlt style={mapIcon} />
      {region.state} - {region.city}
    </div>
    <div>{region.method} ({region.from}-{region.to} days)</div>
    {region.chargeFee === false && (
      <span style={freeDelivery}>✨ FREE DELIVERY</span>
    )}
  </div>
);

const SpecItem = ({ label, value }) => (
  <div style={specRow}>
    <span style={specLabel}>{label}:</span>
    <span style={specValue}>{value}</span>
  </div>
);

const SimilarCard = ({ product }) => (
  <Link to={`/marketplace/${product.id}`} style={similarLink}>
    <div style={similarCardStyle}>
      <img src={product.images?.[0]} alt={product.title} style={similarImg} />
      <div style={similarInfo}>
        <div style={similarCat}>{product.category}</div>
        <h4 style={similarTitle}>{product.title.substring(0, 35)}...</h4>
        <div style={similarPrice}>₦{Number(product.price).toLocaleString()}</div>
      </div>
    </div>
  </Link>
);

// ================ STYLES ================
const pageContainer = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "20px",
  fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  background: "#fafbfc"
};

// ... ALL OTHER STYLES (see below)
const breadcrumb = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#64748b",
  fontSize: "15px",
  marginBottom: "30px",
  padding: "20px 0"
};

const breadcrumbLink = { color: "#007BFF", textDecoration: "none", fontWeight: 500 };
const breadcrumbSep = { color: "#cbd5e1" };
const breadcrumbCurrent = { color: "#1e293b", fontWeight: 600 };

const headerSection = { marginBottom: 40 };
const titleStyle = { 
  fontSize: 36, 
  fontWeight: 800, 
  color: "#0f172a", 
  marginBottom: 16,
  lineHeight: 1.2 
};
const headerBadges = { display: "flex", gap: 12, flexWrap: "wrap" };
const promotedBadge = { 
  background: "linear-gradient(135deg, #ff6b6b, #feca57)", 
  color: "white", 
  padding: "8px 16px", 
  borderRadius: 25, 
  fontSize: 13, 
  fontWeight: 700 
};
const discountBadge = { 
  background: "#ef4444", 
  color: "white", 
  padding: "8px 16px", 
  borderRadius: 25, 
  fontSize: 13, 
  fontWeight: 700 
};
const conditionBadge = { 
  background: "#10b981", 
  color: "white", 
  padding: "8px 16px", 
  borderRadius: 25, 
  fontSize: 13, 
  fontWeight: 500 
};

const mainGrid = { 
  display: "grid", 
  gridTemplateColumns: "1fr 420px", 
  gap: 50, 
  marginBottom: 60 
};

const gallerySection = { display: "flex", flexDirection: "column", gap: 24 };
const mainImageContainer = { 
  position: "relative", 
  height: 500, 
  borderRadius: 24, 
  overflow: "hidden",
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)"
};
const mainImage = { 
  width: "100%", 
  height: "100%", 
  objectFit: "cover",
  transition: "transform 0.3s ease"
};
const videoOverlay = { 
  position: "absolute", 
  bottom: 24, 
  left: 24, 
  background: "rgba(0,0,0,0.8)", 
  color: "white", 
  padding: "12px 24px", 
  borderRadius: 50, 
  textDecoration: "none",
  fontWeight: 600 
};

const thumbnailsContainer = { 
  display: "flex", 
  gap: 12, 
  overflowX: "auto",
  padding: "8px 0"
};
const thumbnailWrapper = (active) => ({
  flexShrink: 0,
  width: 90,
  height: 90,
  borderRadius: 16,
  overflow: "hidden",
  cursor: "pointer",
  border: active ? "3px solid #007BFF" : "2px solid #e2e8f0",
  transition: "all 0.3s ease"
});
const thumbnailImg = { width: "100%", height: "100%", objectFit: "cover" };

const detailsSection = { display: "flex", flexDirection: "column", gap: 24 };

const priceHero = { display: "flex", flexDirection: "column", gap: 8 };
const oldPrice = (show) => ({
  fontSize: 22,
  color: show ? "#9ca3af" : "transparent",
  textDecoration: "line-through"
});
const newPrice = { 
  fontSize: 44, 
  fontWeight: 900, 
  color: "#10b981",
  background: "linear-gradient(135deg, #10b981, #059669)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent"
};

const sellerCard = { 
  background: "white", 
  padding: 32, 
  borderRadius: 20, 
  boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
  border: "1px solid #e5e7eb"
};
const sellerHeader = { display: "flex", gap: 16, alignItems: "center", marginBottom: 20 };
const sellerIcon = { fontSize: 28, color: "#10b981" };
const sellerName = { fontSize: 20, fontWeight: 700, color: "#1e293b" };
const sellerRating = { fontSize: 14, color: "#6b7280" };
const sellerContact = {};
const callButton = { 
  display: "flex", 
  alignItems: "center", 
  gap: 12, 
  width: "100%", 
  padding: 20, 
  background: "linear-gradient(135deg, #007BFF, #0056b3)", 
  color: "white", 
  borderRadius: 16, 
  textDecoration: "none",
  fontWeight: 600, 
  fontSize: 16,
  justifyContent: "center"
};
const phoneIcon = { fontSize: 20 };

const quickStats = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
  gap: 16 
};
const statItem = { 
  display: "flex", 
  alignItems: "center", 
  gap: 12, 
  padding: 20, 
  background: "white", 
  borderRadius: 16, 
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)" 
};
const statIcon = { fontSize: 20, color: "#007BFF" };

const ctaSection = { display: "flex", gap: 16, flexDirection: "column" };
const primaryCTA = { 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  gap: 12, 
  width: "100%", 
  padding: 24, 
  background: "linear-gradient(135deg, #10b981, #059669)", 
  color: "white", 
  borderRadius: 20, 
  fontSize: 20, 
  fontWeight: 700,
  textDecoration: "none",
  boxShadow: "0 20px 40px rgba(16,185,129,0.3)"
};
const secondaryCTA = { 
  width: "100%", 
  padding: 22, 
  background: "white", 
  color: "#007BFF", 
  border: "2px solid #007BFF", 
  borderRadius: 20, 
  fontSize: 18, 
  fontWeight: 600,
  cursor: "pointer"
};

const negotiableBanner = { 
  background: "linear-gradient(135deg, #fef3c7, #fde68a)", 
  color: "#92400e", 
  padding: 20, 
  borderRadius: 20, 
  textAlign: "center", 
  fontSize: 18, 
  fontWeight: 700 
};

// TABS
const tabsSection = { 
  background: "white", 
  borderRadius: 24, 
  padding: 32, 
  marginBottom: 60,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)"
};
const tabHeaders = { 
  display: "flex", 
  gap: 8, 
  marginBottom: 32,
  background: "#f8fafc",
  borderRadius: 16,
  padding: 4,
  flexWrap: "wrap"
};
const tabButtonStyle = (active) => ({
  flex: 1,
  padding: "20px 24px",
  background: active ? "linear-gradient(135deg, #007BFF, #0056b3)" : "transparent",
  color: active ? "white" : "#64748b",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  transition: "all 0.3s ease",
  minWidth: 140
});
const tabContent = { minHeight: 200 };
const tabPanel = {};
const descriptionStyle = { 
  fontSize: 18, 
  lineHeight: 1.7, 
  color: "#334155",
  padding: 24
};

const deliveryGrid = { display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" };
const deliveryCard = { 
  padding: 28, 
  background: "#f0fdf4", 
  borderRadius: 20, 
  borderLeft: "5px solid #10b981"
};
const deliveryHeader = { display: "flex", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 18 };
const mapIcon = { fontSize: 20, color: "#10b981" };
const freeDelivery = { 
  color: "#166534", 
  fontWeight: 700, 
  background: "rgba(16,185,129,0.2)", 
  padding: "8px 16px", 
  borderRadius: 20,
  marginTop: 8,
  display: "inline-block"
};

const specsGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" };
const specRow = { 
  display: "flex", 
  justifyContent: "space-between", 
  padding: 20, 
  background: "#f8fafc", 
  borderRadius: 16 
};
const specLabel = { fontWeight: 600, color: "#374151" };
const specValue = { color: "#007BFF", fontWeight: 600 };

const similarSection = { 
  background: "white", 
  padding: 60, 
  borderRadius: 32,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)"
};
const sectionHeader = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  marginBottom: 40 
};
const sectionTitle = { 
  fontSize: 36, 
  fontWeight: 800, 
  color: "#1e293b", 
  margin: 0 
};
const viewAllLink = { 
  color: "#007BFF", 
  fontSize: 18, 
  fontWeight: 600, 
  textDecoration: "none" 
};
const similarGrid = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
  gap: 24 
};
const similarLink = { textDecoration: "none" };
const similarCardStyle = { 
  background: "#fafbfc", 
  borderRadius: 20, 
  overflow: "hidden",
  boxShadow: "0 15px 35px rgba(0,0,0,0.08)",
  transition: "all 0.3s ease"
};
const similarImg = { width: "100%", height: 200, objectFit: "cover" };
const similarInfo = { padding: 24 };
const similarCat = { 
  background: "#e2e8f0", 
  color: "#475569", 
  padding: "6px 12px", 
  borderRadius: 20, 
  fontSize: 12, 
  fontWeight: 600,
  width: "fit-content"
};
const similarTitle = { 
  fontSize: 18, 
  fontWeight: 700, 
  color: "#1e293b", 
  margin: "12px 0 8px 0"
};
const similarPrice = { 
  fontSize: 22, 
  fontWeight: 800, 
  color: "#10b981" 
};

// Loading States
const loadingContainer = { 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  justifyContent: "center", 
  height: "60vh",
  textAlign: "center"
};
const spinnerStyle = { 
  width: 60, 
  height: 60, 
  border: "4px solid #f3f3f3", 
  borderTop: "4px solid #007BFF", 
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: 24
};
const loadingText = { fontSize: 18, color: "#64748b" };
const notFoundContainer = { 
  textAlign: "center", 
  padding: "100px 20px",
  color: "#64748b"
};
const backLink = { 
  display: "inline-block", 
  marginTop: 20, 
  padding: "12px 24px", 
  background: "#007BFF", 
  color: "white", 
  textDecoration: "none", 
  borderRadius: 12,
  fontWeight: 600
};
const loadingRow = { 
  textAlign: "center", 
  padding: 80, 
  color: "#64748b", 
  fontSize: 18 
};

// Add to your global CSS:
const globalCSS = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@media (max-width: 1024px) {
  .main-grid { grid-template-columns: 1fr !important; }
}
`;
