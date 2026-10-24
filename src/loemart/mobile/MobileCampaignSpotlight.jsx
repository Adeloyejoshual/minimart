import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatPrice,
  calcDiscountPct,
  primaryImg,
  getCampaignTag,
  getCampaignKey,
  getCampaignBanner,
  normalizeCampaign
} from './mobileHelpers';
import './styles/MobileCampaign.css';

export default function MobileCampaignSpotlight({ campaign, products = [] }) {
  const navigate = useNavigate();

  const normalized = normalizeCampaign ? normalizeCampaign(campaign) : campaign;
  const hasProducts = Array.isArray(products) && products.length > 0;

  if (!normalized && !hasProducts) {
    return null;
  }

  const campaignTitle = normalized?.title || normalized?.name || (hasProducts && getCampaignTag ? getCampaignTag(products[0]) : null) || 'Featured Campaign';
  const campaignSub = normalized?.subtitle || normalized?.description || 'Verified admin promotions';
  const campaignBanner = normalized?.banner || (getCampaignBanner ? getCampaignBanner(campaign) : null) || '/assets/banner-campaign.png';
  const campaignKey = normalized?.key || normalized?.slug || (hasProducts && getCampaignKey ? getCampaignKey(products[0]) : null) || campaignTitle;

  const handleCampaignClick = () => {
    navigate(`/m/search?campaign=${encodeURIComponent(campaignKey)}`);
  };

  return (
    <div className="mc-spotlight-wrapper">
      {/* Sleek Campaign Header Banner */}
      <div className="mc-spotlight-banner" onClick={handleCampaignClick}>
        <div
          className="mc-banner-bg"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(255, 96, 0, 0.92) 0%, rgba(180, 20, 0, 0.88) 100%), url(${campaignBanner})`
          }}
        />
        <div className="mc-banner-content">
          <div className="mc-spotlight-badge">
            <span className="mc-badge-pulse" />
            <span>OFFICIAL CAMPAIGN</span>
          </div>

          <h2 className="mc-spotlight-title">{campaignTitle}</h2>
          {campaignSub && <p className="mc-spotlight-subtitle">{campaignSub}</p>}

          <div className="mc-spotlight-cta">
            <span>Explore Deals</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{
                width: '14px',
                height: '14px',
                minWidth: '14px',
                minHeight: '14px',
                maxWidth: '14px',
                maxHeight: '14px',
                flexShrink: 0,
                display: 'inline-block'
              }}
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel with Clean Square Tiles */}
      {hasProducts && (
        <div className="mc-products-scroll-wrapper">
          <div className="mc-products-scroll">
            {products.map((item) => {
              const id = item.id || item.product_id || item.slug;
              const imgUrl = primaryImg(item.primaryImg || item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;
              const oldPrice = item.oldPrice ?? item.old_price ?? item.original_price ?? item.regular_price;
              const discount = calcDiscountPct(price, oldPrice);
              const title = item.title || item.name || 'Product';

              return (
                <div
                  key={id}
                  className="mc-product-tile"
                  onClick={() => navigate(`/product/${id}`)}
                >
                  <div className="mc-tile-img-box">
                    <img src={imgUrl} alt={title} loading="lazy" />
                    {discount > 0 && (
                      <span className="mc-tile-discount">-{discount}%</span>
                    )}
                  </div>

                  <div className="mc-tile-details">
                    <h4 className="mc-tile-title">{title}</h4>
                    <div className="mc-tile-price">{formatPrice(price)}</div>
                    {discount > 0 && (
                      <div className="mc-tile-old-price">{formatPrice(oldPrice)}</div>
                    )}
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