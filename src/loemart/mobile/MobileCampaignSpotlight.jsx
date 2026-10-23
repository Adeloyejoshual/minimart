import React from 'react';
import { useNavigate } from 'react-router-dom';
import { primaryImg, formatPrice, calcDiscountPct, haptic } from './mobileHelpers';
import './styles/MobileCampaign.css';

export default function MobileCampaignSpotlight({ campaign, products = [] }) {
  const navigate = useNavigate();

  if (!campaign && (!products || products.length === 0)) {
    return null; // Gracefully auto-hide if no active campaign items exist
  }

  const campaignTitle = campaign?.title || campaign?.name || campaign?.campaign_name || 'Admin Special Campaign';
  const campaignSubtitle = campaign?.subtitle || campaign?.description || 'Exclusive deals hand-picked for you';
  const campaignBanner = campaign?.banner_url || campaign?.image_url || '/assets/campaign-banner.jpg';
  const campaignSlug = campaign?.slug || campaign?.id || 'active-campaign';

  const handleCampaignClick = (e) => {
    e.preventDefault();
    haptic('medium');
    navigate(`/search?campaign=${encodeURIComponent(campaignTitle)}`);
  };

  const handleProductClick = (productId) => {
    haptic('light');
    navigate(`/product/${productId}`);
  };

  return (
    <div className="mc-spotlight-container">
      {/* Campaign Header Banner */}
      <div 
        className="mc-spotlight-banner"
        onClick={handleCampaignClick}
        style={{ backgroundImage: `linear-gradient(135deg, rgba(255, 96, 0, 0.9), rgba(200, 40, 0, 0.85)), url(${campaignBanner})` }}
      >
        <div className="mc-spotlight-badge">
          <span className="mc-badge-dot"></span> ACTIVE CAMPAIGN
        </div>
        <h2 className="mc-spotlight-title">{campaignTitle}</h2>
        <p className="mc-spotlight-sub">{campaignSubtitle}</p>
        <div className="mc-spotlight-cta">
          <span>Explore Campaign Items</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      </div>

      {/* Horizontal Carousel of Live Campaign Products */}
      {products && products.length > 0 && (
        <div className="mc-spotlight-products-wrapper">
          <div className="mc-spotlight-products-scroll">
            {products.map((item) => {
              const imgUrl = primaryImg(item.image_url || item.images || item.primary_image);
              const price = item.price || item.sale_price;
              const origPrice = item.original_price || item.old_price || item.regular_price;
              const discount = calcDiscountPct(origPrice, price);

              return (
                <div 
                  key={item.id} 
                  className="mc-product-card"
                  onClick={() => handleProductClick(item.id)}
                >
                  <div className="mc-card-img-box">
                    <img src={imgUrl} alt={item.title || item.name} loading="lazy" />
                    {discount > 0 && (
                      <span className="mc-discount-tag">-{discount}%</span>
                    )}
                    <span className="mc-campaign-pill">Campaign</span>
                  </div>
                  <div className="mc-card-info">
                    <h4 className="mc-card-title">{item.title || item.name}</h4>
                    <div className="mc-card-price-row">
                      <span className="mc-card-price">{formatPrice(price)}</span>
                      {discount > 0 && (
                        <span className="mc-card-orig-price">{formatPrice(origPrice)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}