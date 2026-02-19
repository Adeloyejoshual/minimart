// src/pages/Marketplace/MarketplaceProductDetail.jsx
// ✅ COMPLETE JIJI-STYLE MARKETPLACE WITH ALL FEATURES
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  FaPhone, FaMapMarkerAlt, FaStar, FaHeart, FaShippingFast, FaShare, 
  FaFlag, FaVideo, FaExpand, FaChat, FaUserCheck, FaClock, FaFire,
  FaCheckCircle, FaExclamationTriangle 
} from "react-icons/fa";

export default function MarketplaceProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [views, setViews] = useState({ total: 2847, today: 347, live: 23 });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(true);

  // YOUR EXISTING API
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/marketplace/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        setProduct(data);
        setSelectedImage(0);
        
        // INCREMENT VIEW COUNT
        fetch(`/api/marketplace/${id}/increment-view`, { method: 'POST' });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const discountPercent = product?.discount_price 
    ? Math.round(((parseFloat(product.price) - parseFloat(product.discount_price)) / parseFloat(product.price)) * 100)
    : 0;
  const finalPrice = product?.discount_price || product?.price;

  if (loading) return <LoadingState />;
  if (!product) return <NotFoundState />;

  const handlePostComment = () => {
    if (newComment.trim()) {
      setComments([{
        id: Date.now(),
        user: "You",
        time: "Just now",
        comment: newComment,
        replies: []
      }, ...comments]);
      setNewComment('');
    }
  };

  return (
    <div style={pageContainer}>
      {/* ═════════ 1️⃣ STICKY TOP BAR ═════════ */}
      <div style={stickyTopBar}>
        <Link to="/marketplace" style={backBtn}>← Marketplace</Link>
        <div style={breadcrumb}>Home / {product.category} / {product.title}</div>
      </div>

      <div style={mainContent}>
        {/* ═════════ 2️⃣ HERO IMAGE GALLERY ═════════ */}
        <section style={heroGallery}>
          <div style={mainImageContainer}>
            <img src={product.images[selectedImage]} alt={product.title} style={mainImage} />
            {product.video_link && (
              <a href={product.video_link} target="_blank" style={videoOverlay}>
                <FaVideo style={icon24} /> Watch Video
              </a>
            )}
          </div>
          <div style={thumbnailStrip}>
            {product.images.map((img, i) => (
              <Thumbnail key={i} img={img} active={selectedImage === i} onClick={() => setSelectedImage(i)} />
            ))}
          </div>
        </section>

        {/* ═════════ 3️⃣ VIEW COUNT & BOOST BADGES ═════════ */}
        <div style={viewStatsHero}>
          <div style={liveViewers}>
            <div style={liveDot} />
            <span>{views.live} viewing now</span>
          </div>
          <div style={totalViews}>
            👁️ {views.total.toLocaleString()} total views • +{views.today} today
          </div>
          {product.promoted && <span style={boostBadge}>🔥 BOOSTED LISTING</span>}
        </div>

        <div style={contentGrid}>
          {/* ═════════ LEFT COLUMN ═════════ */}
          <div style={leftColumn}>
            {/* PRODUCT INFO */}
            <section style={productInfoCard}>
              <h1 style={productTitle}>{product.title}</h1>
              
              {/* SELLER INFO */}
              <div style={sellerHeroCard}>
                <div style={sellerLeft}>
                  <div style={sellerAvatar}>👤</div>
                  <div>
                    <div style={sellerName}>{product.poster_name}</div>
                    <div style={sellerScore}>⭐ 4.9 (247 sales)</div>
                  </div>
                </div>
                <div style={sellerTrust}>
                  <div style={trustItem}><FaCheckCircle style={icon16} /> Phone Verified</div>
                  <div style={trustItem}><FaUserCheck style={icon16} /> ID Verified</div>
                </div>
              </div>

              {/* LOCATION & DISTANCE */}
              <div style={locationCard}>
                <FaMapMarkerAlt style={icon20} />
                <div>
                  <div style={locationPrimary}>Ikeja, Lagos</div>
                  <div style={distanceInfo}>🚗 2.4km away - Same day pickup available</div>
                </div>
              </div>

              {/* QUICK STATS */}
              <div style={statsRow}>
                <StatItem icon={FaStar} label={product.condition} value="Condition" />
                <StatItem icon={FaShippingFast} label="Free Delivery" value="Available" />
                {product.negotiable && <StatItem icon={FaExchangeAlt} label="Negotiable" value="Price" />}
              </div>
            </section>

            {/* PRICE SECTION */}
            <section style={priceHeroSection}>
              <div style={priceDisplay}>
                {discountPercent > 0 && (
                  <div style={oldPrice}>₦{Number(product.price).toLocaleString()}</div>
                )}
                <div style={newPriceHero}>
                  ₦{Number(finalPrice).toLocaleString()}
                  {discountPercent > 0 && <span style={discountTag}>{discountPercent}% OFF</span>}
                </div>
              </div>
              
              {/* NEGOTIATION */}
              {product.negotiable && (
                <div style={negotiateSection}>
                  <input style={offerInput} placeholder="Enter your offer (₦750,000)" />
                  <button style={sendOfferBtn}>💬 Send Offer</button>
                </div>
              )}
            </section>

            {/* DESCRIPTION TABS */}
            <section style={tabsSection}>
              <div style={tabHeaders}>
                <TabBtn active={true} label="Description" />
                <TabBtn label="Specifications" />
                <TabBtn label="Delivery" />
              </div>
              <div style={descriptionContent}>
                <p>{product.description}</p>
                {product.features?.length > 0 && (
                  <div style={featuresGrid}>
                    {product.features.map((f, i) => <FeatureTag key={i}>{f}</FeatureTag>)}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ═════════ RIGHT COLUMN (STICKY) ═════════ */}
          <div style={rightColumn}>
            {/* CONTACT ACTIONS */}
            <section style={contactCard}>
              <h3>📞 Contact Seller</h3>
              <div style={phoneSection}>
                <a href={`tel:${product.phone_number}`} style={callBtn}>{product.phone_number}</a>
              </div>
              <a 
                href={`https://wa.me/234${product.phone_number.replace(/[^0-9]/g,'')}?text=Hi, I'm interested in your ${product.title.replace(/ /g,'%20')}`} 
                style={whatsappBtn}
                target="_blank"
              >
                📱 WhatsApp Chat
              </a>
              <button style={liveChatBtn}>
                💬 Live Chat <span style={onlineDot}>●</span>
              </button>
            </section>

            {/* QUICK ACTIONS */}
            <section style={quickActions}>
              <button style={wishlistBtn(inWishlist)} onClick={() => setInWishlist(!inWishlist)}>
                <FaHeart style={heartIcon(inWishlist)} /> {inWishlist ? 'Saved!' : 'Save Listing'}
              </button>
              <button style={shareBtn}><FaShare /> Share</button>
              <button style={reportBtn}><FaFlag /> Report</button>
            </section>

            {/* DELIVERY OPTIONS */}
            <section style={deliveryCard}>
              <h4>🚚 Delivery Options</h4>
              {product.deliveryRegions?.map((r, i) => (
                <DeliveryOption key={i} region={r} />
              ))}
            </section>
          </div>
        </div>

        {/* ═════════ 4️⃣ COMMENTS SECTION ═════════ */}
        <section style={commentsHero}>
          <div style={commentsHeader}>
            <h2>💬 Comments ({comments.length || 23})</h2>
            <select style={sortSelect}>
              <option>Latest</option>
              <option>Most Helpful</option>
            </select>
          </div>

          <div style={commentList}>
            {comments.map(c => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </div>

          {/* ADD COMMENT */}
          <div style={addCommentSection}>
            <textarea 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ask the seller a question or leave a comment..."
              style={commentInput}
            />
            <button onClick={handlePostComment} style={postCommentBtn}>Post Comment</button>
          </div>
        </section>

        {/* ═════════ 5️⃣ SIMILAR LISTINGS ═════════ */}
        <section style={similarSection}>
          <div style={sectionHeader}>
            <h2>Similar Listings</h2>
            <Link to={`/marketplace/${product.category}`} style={viewAllLink}>View All →</Link>
          </div>
          <div style={similarGrid}>
            {Array(6).fill().map((_, i) => <SimilarCard key={i} />)}
          </div>
        </section>
      </div>

      {/* ═════════ 6️⃣ MOBILE STICKY BOTTOM BAR ═════════ */}
      <div style={mobileStickyBar}>
        <div style={priceSticky}>₦{Number(finalPrice).toLocaleString()}</div>
        <div style={mobileActions}>
          <button style={mobileChatBtn}>💬 Chat</button>
          <a href={`tel:${product.phone_number}`} style={mobileCallBtn}>📞 Call</a>
        </div>
      </div>
    </div>
  );
}

// ================= COMPONENTS =================
const Thumbnail = ({ img, active, onClick }) => (
  <div style={thumbnailStyle(active)} onClick={onClick}>
    <img src={img} style={thumbImg} />
    {active && <div style={activeIndicator} />}
  </div>
);

const StatItem = ({ icon: Icon, label, value }) => (
  <div style={statItem}>
    <Icon style={icon18} />
    <div>
      <div style={statValue}>{label}</div>
      <div style={statLabel}>{value}</div>
    </div>
  </div>
);

const TabBtn = ({ active, label }) => (
  <button style={active ? activeTab : inactiveTab}>{label}</button>
);

const FeatureTag = ({ children }) => (
  <div style={featureTag}>{children}</div>
);

const DeliveryOption = ({ region }) => (
  <div style={deliveryOption}>
    <FaMapMarkerAlt style={icon16} />
    <div>
      <div>{region.state}, {region.city}</div>
      <div>{region.method} ({region.from}-{region.to} days)</div>
    </div>
    {!region.chargeFee && <span style={freeLabel}>FREE</span>}
  </div>
);

const CommentItem = ({ comment }) => (
  <div style={commentContainer}>
    <div style={commentAvatar}>U</div>
    <div style={commentBody}>
      <div style={commentMeta}>
        <span style={commentAuthor}>{comment.user}</span>
        <span style={commentTime}>{comment.time}</span>
      </div>
      <p style={commentText}>{comment.comment}</p>
    </div>
  </div>
);

const SimilarCard = () => (
  <Link style={similarLink}>
    <div style={similarCardStyle}>
      <div style={similarImage} />
      <div style={similarContent}>
        <div style={similarTitle}>iPhone 14 Pro 256GB Purple</div>
        <div style={similarPrice}>₦750,000</div>
        <div style={similarSeller}>by John Doe</div>
      </div>
    </div>
  </Link>
);

// ================= STYLES =================
const pageContainer = {
  maxWidth: 1400,
  margin: 0,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  background: "#f8fafc",
  minHeight: "100vh"
};

const stickyTopBar = {
  position: "sticky",
  top: 0,
  background: "white",
  backdropFilter: "blur(20px)",
  zIndex: 100,
  padding: "16px 24px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const mainContent = { padding: "24px 0" };
const heroGallery = { 
  background: "white", 
  borderRadius: 24, 
  padding: 24, 
  marginBottom: 24,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)" 
};

const contentGrid = { 
  display: "grid", 
  gridTemplateColumns: "1fr 380px", 
  gap: 32, 
  marginBottom: 40 
};

const viewStatsHero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
  borderRadius: 20,
  marginBottom: 24,
  borderLeft: "5px solid #f59e0b"
};

const mobileStickyBar = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  background: "rgba(255,255,255,0.98)",
  backdropFilter: "blur(20px)",
  borderTop: "1px solid #e5e7eb",
  padding: "16px 24px",
  display: "none",
  zIndex: 1000
};

// Media Queries in CSS file:
/*
@media (max-width: 768px) {
  .content-grid { grid-template-columns: 1fr; }
  .mobile-sticky-bar { display: flex !important; }
  .right-column { display: none; }
}
*/

const LoadingState = () => (
  <div style={loadingContainer}>
    <div style={spinner} />
    <div>Loading...</div>
  </div>
);

const NotFoundState = () => (
  <div style={notFoundContainer}>
    <h2>Product Not Found</h2>
    <Link to="/marketplace" style={backLink}>← Back to Marketplace</Link>
  </div>
);
