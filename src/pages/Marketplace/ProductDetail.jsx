// src/pages/Marketplace/ProductDetail.jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { FaPhone, FaMapMarkerAlt, FaExchangeAlt, FaShippingFast, FaStar, FaHeart, FaFire, FaUsers, FaClock } from "react-icons/fa";
import { useAuth0 } from "@auth0/auth0-react";

export default function ProductDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth0();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [contactVisible, setContactVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wishlist, setWishlist] = useState(false);

  // Premium gradient backgrounds
  const gradientBg = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  const goldGradient = "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)";
  const blueGradient = "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)";

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/marketplace/${id}`);
        const data = await res.json();
        setProduct(data);
        setCurrentImage(0);
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  // Fetch similar products
  const fetchSimilarProducts = useCallback(async () => {
    setLoadingSimilar(true);
    try {
      const res = await fetch(`/api/marketplace?category=${product?.category}&limit=8&exclude=${id}`);
      const data = await res.json();
      setSimilarProducts(data);
    } catch (err) {
      console.error("Error fetching similar products:", err);
    } finally {
      setLoadingSimilar(false);
    }
  }, [product?.category, id]);

  useEffect(() => {
    if (product) {
      fetchSimilarProducts();
    }
  }, [product, fetchSimilarProducts]);

  if (loading) {
    return <PremiumLoading />;
  }

  if (!product) {
    return <NotFound />;
  }

  const discountPercent = product.discount_price 
    ? Math.round(((parseFloat(product.price.replace(/,/g, '')) - parseFloat(product.discount_price)) / parseFloat(product.price.replace(/,/g, ''))) * 100)
    : 0;
  const finalPrice = product.discount_price || product.price;

  return (
    <div style={pageContainer}>
      {/* Premium Header with Sticky CTA */}
      <PremiumHeader product={product} finalPrice={finalPrice} />

      <div style={mainContent}>
        {/* Breadcrumb */}
        <Breadcrumb product={product} />

        <div style={heroGrid}>
          {/* Premium Image Gallery */}
          <PremiumImageGallery 
            images={product.images} 
            video_link={product.video_link}
            currentImage={currentImage}
            onImageChange={setCurrentImage}
          />

          {/* Premium Product Info */}
          <PremiumProductInfo 
            product={product}
            discountPercent={discountPercent}
            finalPrice={finalPrice}
            contactVisible={contactVisible}
            setContactVisible={setContactVisible}
            quantity={quantity}
            setQuantity={setQuantity}
            wishlist={wishlist}
            setWishlist={setWishlist}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </div>

      {/* Premium Trust Section */}
      <PremiumTrustSection product={product} />

      {/* Premium Tabs */}
      <PremiumTabs activeTab={activeTab} setActiveTab={setActiveTab} product={product} />

      {/* Similar Products - Premium Carousel */}
      <SimilarProductsSection 
        similarProducts={similarProducts}
        loadingSimilar={loadingSimilar}
        category={product.category}
      />
    </div>
  );
}

// Premium Loading Component
const PremiumLoading = () => (
  <div style={loadingContainer}>
    <div style={premiumSpinner} />
    <div style={loadingText}>Loading Premium Product Details</div>
    <div style={loadingSubtext}>Crafted with precision for you</div>
  </div>
);

// Premium Header (Sticky CTA)
const PremiumHeader = ({ product, finalPrice }) => (
  <div style={headerStyle}>
    <div style={headerContent}>
      <div style={headerLeft}>
        <span style={categoryBadge}>{product.category}</span>
        {product.promoted && <span style={promotedBadge}>🔥 PREMIUM LISTING</span>}
      </div>
      <div style={stickyCta}>
        <button style={stickyCtaButton}>
          <FaPhone style={{marginRight: '8px'}} /> Contact Seller
        </button>
      </div>
    </div>
  </div>
);

// Premium Breadcrumb
const Breadcrumb = ({ product }) => (
  <div style={breadcrumbContainer}>
    <Link to="/marketplace" style={breadcrumbLink}>Marketplace</Link>
    <span style={breadcrumbSeparator}>/</span>
    <Link to={`/marketplace/${product.category}`} style={breadcrumbLink}>{product.category}</Link>
    <span style={breadcrumbSeparator}>/</span>
    <span style={breadcrumbCurrent}>{product.title.substring(0, 50)}...</span>
  </div>
);

// Premium Image Gallery
const PremiumImageGallery = ({ images, video_link, currentImage, onImageChange }) => (
  <div style={galleryContainer}>
    <div style={mainImageWrapper}>
      <img src={images[currentImage]} alt="Product" style={mainImagePremium} />
      {video_link && (
        <a href={video_link} target="_blank" rel="noopener noreferrer" style={videoOverlay}>
          <div style={videoIcon}>▶️</div>
          Watch Video Demo
        </a>
      )}
    </div>
    <div style={thumbnailsPremium}>
      {images.slice(0, 5).map((img, i) => (
        <div 
          key={i}
          style={thumbnailWrapperPremium(i === currentImage)}
          onClick={() => onImageChange(i)}
        >
          <img src={img} alt={`Thumb ${i+1}`} style={thumbnailImagePremium} />
          {i === currentImage && <div style={activeThumbnailIndicator} />}
        </div>
      ))}
    </div>
  </div>
);

// Premium Product Info
const PremiumProductInfo = ({ product, discountPercent, finalPrice, contactVisible, setContactVisible, quantity, setQuantity, wishlist, setWishlist, isAuthenticated }) => (
  <div style={infoPremium}>
    <div style={sellerPremium}>
      <div style={sellerAvatar}>👤</div>
      <div>
        <div style={sellerNamePremium}>{product.poster_name}</div>
        <div style={sellerVerified}>✅ Verified Seller • 4.9⭐ (127)</div>
      </div>
    </div>

    <h1 style={titlePremium}>{product.title}</h1>

    <div style={pricePremium}>
      {discountPercent > 0 && (
        <div style={originalPricePremium}>₦{product.price.toLocaleString()}</div>
      )}
      <div style={finalPricePremium}>
        ₦{finalPrice.toLocaleString()}
        {discountPercent > 0 && <span style={discountPremium}>{discountPercent}% OFF</span>}
      </div>
    </div>

    <div style={premiumStats}>
      <StatItem icon={FaStar} label={`${product.condition}`} value="Condition" />
      <StatItem icon={FaClock} label={product.promoted ? "Premium Boost" : "Standard"} value="Listing" />
      {product.deliveryRegions?.length > 0 && (
        <StatItem icon={FaShippingFast} label="Free Delivery" value="Available" />
      )}
    </div>

    <div style={ctaPremium}>
      <button style={primaryCtaPremium} onClick={() => setContactVisible(!contactVisible)}>
        <FaPhone style={ctaIcon} /> {contactVisible ? 'Hide Contact' : 'Contact Seller Now'}
      </button>
      {isAuthenticated && (
        <button 
          style={wishlist ? wishlistActive : wishlistButton} 
          onClick={() => setWishlist(!wishlist)}
        >
          <FaHeart style={wishlist ? heartActive : ctaIcon} /> {wishlist ? 'Saved!' : 'Add to Wishlist'}
        </button>
      )}
    </div>

    {product.negotiable && (
      <div style={negotiablePremium}>💬 Price Negotiable - Make an Offer</div>
    )}

    {product.quantity && (
      <div style={quantityPremium}>
        <label>Quantity</label>
        <div style={quantityControls}>
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={qtyButton}>-</button>
          <input 
            type="number" 
            value={quantity} 
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value)))}
            style={qtyInput}
            min="1" 
            max={product.quantity}
          />
          <button onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))} style={qtyButton}>+</button>
        </div>
        <span style={stockInfo}>{product.quantity} available</span>
      </div>
    )}
  </div>
);

// Premium Trust Section
const PremiumTrustSection = ({ product }) => (
  <div style={trustSection}>
    <h3 style={trustTitle}>Why Buy This Product?</h3>
    <div style={trustGrid}>
      <TrustCard icon={FaUsers} title="Verified Seller" desc="100% authenticated seller" />
      <TrustCard icon={FaFire} title="Fast Response" desc="Replies within 2 hours" />
      <TrustCard icon={FaShippingFast} title="Safe Delivery" desc="Secured payment protection" />
      <TrustCard icon={FaShield} title="7 Day Return" desc="Hassle-free returns" />
    </div>
  </div>
);

// Premium Tabs
const PremiumTabs = ({ activeTab, setActiveTab, product }) => (
  <div style={tabsContainer}>
    <div style={tabHeaders}>
      <button style={tabButton(activeTab === 'description')} onClick={() => setActiveTab('description')}>
        Description
      </button>
      <button style={tabButton(activeTab === 'specs')} onClick={() => setActiveTab('specs')}>
        Specifications
      </button>
      <button style={tabButton(activeTab === 'delivery')} onClick={() => setActiveTab('delivery')}>
        Delivery
      </button>
    </div>
    
    <div style={tabContent}>
      {activeTab === 'description' && (
        <div style={tabPanel}>
          <p style={descriptionPremium}>{product.description}</p>
        </div>
      )}
      
      {activeTab === 'specs' && (
        <div style={specsPremium}>
          <SpecGrid product={product} />
        </div>
      )}
      
      {activeTab === 'delivery' && (
        <div style={deliveryPremium}>
          {product.deliveryRegions?.map((region, i) => (
            <DeliveryCard key={i} region={region} />
          ))}
        </div>
      )}
    </div>
  </div>
);

// Similar Products Section
const SimilarProductsSection = ({ similarProducts, loadingSimilar, category }) => (
  <div style={similarSection}>
    <div style={sectionHeader}>
      <h2 style={sectionTitle}>Similar Premium Products</h2>
      <Link to={`/marketplace/${category}`} style={viewAllLink}>View All →</Link>
    </div>
    
    {loadingSimilar ? (
      <div style={similarSkeleton}>Loading similar products...</div>
    ) : (
      <div style={similarGrid}>
        {similarProducts.map(product => (
          <SimilarProductCard key={product.id} product={product} />
        ))}
      </div>
    )}
  </div>
);

// Helper Components
const StatItem = ({ icon: Icon, label, value }) => (
  <div style={statPremium}>
    <Icon style={statIcon} />
    <div>
      <div style={statValue}>{label}</div>
      <div style={statLabel}>{value}</div>
    </div>
  </div>
);

const TrustCard = ({ icon: Icon, title, desc }) => (
  <div style={trustCard}>
    <div style={trustIcon}>{<Icon />}</div>
    <h4 style={trustCardTitle}>{title}</h4>
    <p style={trustCardDesc}>{desc}</p>
  </div>
);

const SpecGrid = ({ product }) => (
  <div style={specGridPremium}>
    {product.ram && <SpecItem label="RAM" value={product.ram} />}
    {product.storage && <SpecItem label="Storage" value={product.storage} />}
    {product.color && <SpecItem label="Color" value={product.color} />}
    {product.engine && <SpecItem label="Engine" value={product.engine} />}
    {product.mileage && <SpecItem label="Mileage" value={product.mileage} />}
    {product.fuel_type && <SpecItem label="Fuel" value={product.fuel_type} />}
    {product.year && <SpecItem label="Year" value={product.year} />}
    {product.sim?.length > 0 && <SpecItem label="SIM" value={product.sim.join(', ')} />}
  </div>
);

const SpecItem = ({ label, value }) => (
  <div style={specItemPremium}>
    <span style={specLabelPremium}>{label}:</span>
    <span style={specValuePremium}>{value}</span>
  </div>
);

const DeliveryCard = ({ region }) => (
  <div style={deliveryCardPremium}>
    <div style={deliveryHeaderPremium}>
      <FaMapMarkerAlt style={iconSmall} />
      {region.state} - {region.city}
    </div>
    <div>{region.method} ({region.from}-{region.to} days)</div>
    {region.isFreeDelivery && <div style={freeDeliveryPremium}>✨ FREE DELIVERY</div>}
  </div>
);

const SimilarProductCard = ({ product }) => (
  <Link to={`/marketplace/product/${product.id}`} style={similarCardLink}>
    <div style={similarCard}>
      <img src={product.images[0]} alt={product.title} style={similarImage} />
      <div style={similarInfo}>
        <div style={similarCategory}>{product.category}</div>
        <h4 style={similarTitle}>{product.title.substring(0, 40)}...</h4>
        <div style={similarPrice}>₦{product.price.toLocaleString()}</div>
        <div style={similarSeller}>by {product.poster_name}</div>
      </div>
    </div>
  </Link>
);

// All Premium Styles
const pageContainer = {
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "20px",
  background: "#fafbfc",
  minHeight: "100vh",
  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
};

const headerStyle = {
  position: "sticky",
  top: 0,
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  zIndex: 100,
  padding: "15px 0",
  borderBottom: "1px solid rgba(0,0,0,0.05)"
};

const headerContent = { maxWidth: "1400px", margin: "0 auto", padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const headerLeft = { display: "flex", gap: "12px", alignItems: "center" };
const categoryBadge = { background: blueGradient, color: "white", padding: "6px 14px", borderRadius: "25px", fontSize: "13px", fontWeight: "600" };
const promotedBadge = { background: goldGradient, color: "white", padding: "6px 14px", borderRadius: "25px", fontSize: "13px", fontWeight: "600", boxShadow: "0 4px 15px rgba(240,87,108,0.4)" };
const stickyCta = { display: "none" };
const stickyCtaButton = { background: "#007BFF", color: "white", padding: "12px 24px", borderRadius: "30px", border: "none", fontWeight: "600", fontSize: "16px" };

const mainContent = { maxWidth: "1400px", margin: "0 auto" };

const breadcrumbContainer = { 
  display: "flex", 
  alignItems: "center", 
  gap: "8px", 
  color: "#64748b", 
  fontSize: "15px", 
  marginBottom: "40px", 
  padding: "20px 0" 
};
const breadcrumbLink = { color: "#007BFF", textDecoration: "none", fontWeight: "500" };
const breadcrumbSeparator = { color: "#cbd5e1" };
const breadcrumbCurrent = { color: "#1e293b", fontWeight: "600" };

const heroGrid = { 
  display: "grid", 
  gridTemplateColumns: "1fr 420px", 
  gap: "50px", 
  marginBottom: "60px",
  '@media (max-width: 1024px)': { gridTemplateColumns: "1fr", gap: "40px" }
};

const galleryContainer = { maxWidth: "600px" };
const mainImageWrapper = { position: "relative", borderRadius: "24px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" };
const mainImagePremium = { 
  width: "100%", 
  height: "550px", 
  objectFit: "cover",
  transition: "transform 0.4s ease",
  cursor: "pointer"
};
const videoOverlay = { 
  position: "absolute", 
  bottom: "30px", 
  left: "30px",
  background: "rgba(0,0,0,0.8)",
  color: "white",
  padding: "16px 28px",
  borderRadius: "50px",
  textDecoration: "none",
  fontWeight: "600",
  fontSize: "15px",
  backdropFilter: "blur(10px)"
};
const videoIcon = { fontSize: "20px", marginRight: "8px" };

const thumbnailsPremium = { 
  display: "flex", 
  gap: "12px", 
  paddingTop: "20px",
  overflowX: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  WebkitOverflowScrolling: "touch"
};
const thumbnailWrapperPremium = (active) => ({
  position: "relative",
  flexShrink: 0,
  width: "90px",
  height: "90px",
  borderRadius: "16px",
  overflow: "hidden",
  cursor: "pointer",
  border: active ? "3px solid #007BFF" : "2px solid #e2e8f0",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  boxShadow: active ? "0 0 0 4px rgba(0,123,255,0.1)" : "none"
});
const thumbnailImagePremium = { 
  width: "100%", 
  height: "100%", 
  objectFit: "cover" 
};
const activeThumbnailIndicator = { 
  position: "absolute",
  bottom: "-4px",
  right: "-4px",
  width: "24px",
  height: "24px",
  background: "#007BFF",
  borderRadius: "50%",
  border: "3px solid white"
};

const infoPremium = { display: "flex", flexDirection: "column", gap: "24px" };

const sellerPremium = { 
  display: "flex", 
  alignItems: "center", 
  gap: "16px", 
  padding: "20px", 
  background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", 
  borderRadius: "20px" 
};
const sellerAvatar = { 
  width: "50px", 
  height: "50px", 
  borderRadius: "50%", 
  background: gradientBg, 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  fontSize: "20px", 
  boxShadow: "0 10px 25px rgba(102,126,234,0.3)"
};
const sellerNamePremium = { fontSize: "20px", fontWeight: "700", color: "#1e293b" };
const sellerVerified = { fontSize: "14px", color: "#059669", fontWeight: "500" };

const titlePremium = { 
  fontSize: "36px", 
  fontWeight: "800", 
  color: "#0f172a", 
  lineHeight: "1.2", 
  margin: 0 
};

const pricePremium = { display: "flex", flexDirection: "column", gap: "12px" };
const originalPricePremium = { 
  fontSize: "22px", 
  color: "#64748b", 
  textDecoration: "line-through", 
  fontWeight: "500" 
};
const finalPricePremium = { 
  display: "flex", 
  alignItems: "baseline", 
  gap: "12px",
  fontSize: "44px", 
  fontWeight: "900", 
  background: "linear-gradient(135deg, #10b981, #059669)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  lineHeight: "1"
};
const discountPremium = { 
  background: "linear-gradient(135deg, #ef4444, #dc2626)", 
  color: "white", 
  padding: "8px 20px", 
  borderRadius: "50px", 
  fontSize: "16px", 
  fontWeight: "700" 
};

const premiumStats = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
  gap: "16px" 
};
const statPremium = { 
  display: "flex", 
  alignItems: "center", 
  gap: "16px", 
  padding: "20px", 
  background: "white", 
  borderRadius: "20px", 
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.05)"
};
const statIcon = { fontSize: "24px", color: "#007BFF" };
const statValue = { fontSize: "18px", fontWeight: "700", color: "#1e293b" };
const statLabel = { fontSize: "14px", color: "#64748b" };

const ctaPremium = { display: "flex", flexDirection: "column", gap: "16px" };
const primaryCtaPremium = { 
  background: gradientBg, 
  color: "white", 
  padding: "24px 32px", 
  borderRadius: "24px", 
  border: "none", 
  fontSize: "20px", 
  fontWeight: "700", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  gap: "12px",
  boxShadow: "0 20px 40px rgba(102,126,234,0.4)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  cursor: "pointer"
};
const wishlistButton = { 
  background: "white", 
  color: "#64748b", 
  padding: "20px 28px", 
  border: "2px solid #e2e8f0", 
  borderRadius: "24px", 
  fontSize: "18px", 
  fontWeight: "600", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  gap: "12px",
  transition: "all 0.3s ease",
  cursor: "pointer"
};
const wishlistActive = { 
  ...wishlistButton, 
  background: goldGradient, 
  color: "white", 
  borderColor: "transparent",
  boxShadow: "0 15px 35px rgba(240,87,108,0.4)"
};
const ctaIcon = { fontSize: "22px" };
const heartActive = { fontSize: "22px", color: "white" };

const quantityPremium = { 
  background: "white", 
  padding: "28px", 
  borderRadius: "24px", 
  boxShadow: "0 10px 30px rgba(0,0,0,0.1)" 
};
const quantityControls = { 
  display: "flex", 
  alignItems: "center", 
  gap: "12px", 
  margin: "16px 0" 
};
const qtyButton = { 
  width: "48px", 
  height: "48px", 
  border: "2px solid #e2e8f0", 
  background: "white", 
  borderRadius: "12px", 
  fontSize: "20px", 
  fontWeight: "700", 
  cursor: "pointer",
  transition: "all 0.2s ease"
};
const qtyInput = { 
  width: "80px", 
  height: "48px", 
  border: "2px solid #e2e8f0", 
  borderRadius: "12px", 
  textAlign: "center", 
  fontSize: "18px", 
  fontWeight: "600" 
};
const stockInfo = { color: "#059669", fontWeight: "600", fontSize: "16px" };

const negotiablePremium = { 
  background: "linear-gradient(135deg, #fef3c7, #fde68a)", 
  color: "#92400e", 
  padding: "20px 28px", 
  borderRadius: "24px", 
  fontSize: "18px", 
  fontWeight: "700", 
  textAlign: "center",
  boxShadow: "0 10px 30px rgba(254,230,138,0.4)"
};

const trustSection = { 
  background: "white", 
  padding: "60px 40px", 
  borderRadius: "32px", 
  marginBottom: "60px",
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)"
};
const trustTitle = { 
  textAlign: "center", 
  fontSize: "32px", 
  fontWeight: "800", 
  color: "#1e293b", 
  marginBottom: "40px" 
};
const trustGrid = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
  gap: "30px" 
};
const trustCard = { 
  textAlign: "center", 
  padding: "40px 24px", 
  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", 
  borderRadius: "24px",
  transition: "all 0.3s ease",
  border: "1px solid rgba(0,0,0,0.05)"
};
const trustIcon = { 
  width: "80px", 
  height: "80px", 
  borderRadius: "50%", 
  background: gradientBg, 
  margin: "0 auto 20px", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center",
  fontSize: "32px",
  color: "white",
  boxShadow: "0 15px 35px rgba(102,126,234,0.3)"
};
const trustCardTitle = { fontSize: "22px", fontWeight: "700", color: "#1e293b", marginBottom: "12px" };
const trustCardDesc = { fontSize: "16px", color: "#64748b", lineHeight: "1.6" };

const tabsContainer = { 
  background: "white", 
  borderRadius: "32px", 
  padding: "8px",
  boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
  marginBottom: "80px",
  border: "1px solid rgba(0,0,0,0.05)"
};
const tabHeaders = { 
  display: "flex", 
  background: "linear-gradient(90deg, #f8fafc, #e2e8f0)", 
  borderRadius: "24px",
  overflow: "hidden",
  marginBottom: "32px"
};
const tabButton = (active) => ({
  flex: 1,
  padding: "20px 32px",
  background: active ? gradientBg : "transparent",
  color: active ? "white" : "#64748b",
  border: "none",
  fontSize: "18px",
  fontWeight: active ? "700" : "500",
  cursor: "pointer",
  transition: "all 0.3s ease"
});
const tabContent = { padding: "0 40px" };
const tabPanel = { padding: "40px 0" };
const descriptionPremium = { 
  fontSize: "18px", 
  lineHeight: "1.8", 
  color: "#334155" 
};

const specsPremium = { padding: "40px 0" };
const specGridPremium = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
  gap: "24px" 
};
const specItemPremium = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center",
  padding: "24px 32px",
  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
  borderRadius: "20px",
  border: "1px solid rgba(0,0,0,0.05)"
};
const specLabelPremium = { fontSize: "18px", fontWeight: "700", color: "#1e293b" };
const specValuePremium = { fontSize: "18px", color: "#007BFF", fontWeight: "600" };

const deliveryPremium = { padding: "40px 0" };
const deliveryCardPremium = { 
  display: "flex", 
  flexDirection: "column", 
  gap: "12px",
  padding: "32px",
  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  borderRadius: "24px",
  borderLeft: "5px solid #10b981",
  marginBottom: "20px"
};
const deliveryHeaderPremium = { 
  display: "flex", 
  alignItems: "center", 
  gap: "12px", 
  fontSize: "20px", 
  fontWeight: "700", 
  color: "#166534" 
};
const freeDeliveryPremium = { 
  color: "#166534", 
  fontSize: "18px", 
  fontWeight: "700",
  background: "rgba(16,185,129,0.2)",
  padding: "8px 20px",
  borderRadius: "20px",
  alignSelf: "flex-start"
};

const similarSection = { 
  background: "white", 
  padding: "80px 40px", 
  borderRadius: "32px", 
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.1)",
  marginTop: "80px"
};
const sectionHeader = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  marginBottom: "50px" 
};
const sectionTitle = { 
  fontSize: "36px", 
  fontWeight: "800", 
  background: gradientBg,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  margin: 0
};
const viewAllLink = { 
  color: "#007BFF", 
  fontSize: "18px", 
  fontWeight: "600", 
  textDecoration: "none" 
};

const similarSkeleton = { 
  textAlign: "center", 
  padding: "80px", 
  color: "#64748b", 
  fontSize: "18px" 
};

const similarGrid = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
  gap: "32px" 
};
const similarCardLink = { textDecoration: "none" };
const similarCard = { 
  background: "white", 
  borderRadius: "24px", 
  overflow: "hidden",
  boxShadow: "0 15px 35px rgba(0,0,0,0.08)",
  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  border: "1px solid rgba(0,0,0,0.05)"
};
const similarImage = { 
  width: "100%", 
  height: "220px", 
  objectFit: "cover" 
};
const similarInfo = { padding: "28px" };
const similarCategory = { 
  background: "#e2e8f0", 
  color: "#475569", 
  padding: "6px 16px", 
  borderRadius: "20px", 
  fontSize: "13px", 
  fontWeight: "600",
  width: "fit-content"
};
const similarTitle = { 
  fontSize: "20px", 
  fontWeight: "700", 
  color: "#1e293b", 
  margin: "16px 0 12px 0",
  lineHeight: "1.4"
};
const similarPrice = { 
  fontSize: "24px", 
  fontWeight: "800", 
  color: "#10b981" 
};
const similarSeller = { 
  fontSize: "14px", 
  color: "#64748b", 
  marginTop: "8px" 
};

const iconSmall = { fontSize: "20px", color: "#10b981" };

// Responsive Styles
const responsiveStyles = `
  @media (max-width: 1024px) {
    .hero-grid { grid-template-columns: 1fr !important; }
    .header-content { padding: 0 20px !important; }
  }
  @media (max-width: 768px) {
    .sticky-cta { display: block !important; }
    .header-left { display: none !important; }
  }
`;
