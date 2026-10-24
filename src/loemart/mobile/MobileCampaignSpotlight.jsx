import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice, primaryImg, haptic } from './mobileHelpers';
import './MobileCampaign.css';

const MobileCampaignSpotlight = ({ 
  title = "Flash Sale", 
  products = [], 
  type = "flash", // flash, sponsored, trending
  endTime = null 
}) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState("");

  // WAT (UTC+1) Midnight Timer Logic
  useEffect(() => {
    if (type !== 'flash') return;

    const timer = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); // Midnight
      
      const diff = tomorrow - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [type]);

  if (!products || products.length === 0) return null;

  return (
    <section className={`campaign-spotlight ${type}`}>
      <div className="spotlight-header">
        <div className="header-left">
          <h2 className="spotlight-title">{title}</h2>
          {type === 'flash' && (
            <div className="flash-timer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{timeLeft}</span>
            </div>
          )}
        </div>
        <button 
          className="see-all-btn" 
          onClick={() => navigate(`/m/search?filter=${type}`)}
        >
          See All
        </button>
      </div>

      <div className="horizontal-scroll-container">
        {products.map((prod) => (
          <div 
            key={prod.id} 
            className="horizontal-product-card"
            onClick={() => { haptic('light'); navigate(`/product/${prod.slug || prod.id}`); }}
          >
            <div className="card-image-wrapper">
              <img 
                src={primaryImg(prod.primaryImg)} 
                alt={prod.name} 
                className="card-img" 
                loading="lazy"
              />
              {prod.discount > 0 && (
                <span className="discount-tag">-{prod.discount}%</span>
              )}
            </div>
            <div className="card-info">
              <h4 className="card-name">{prod.name}</h4>
              <div className="price-row">
                <span className="current-price">{formatPrice(prod.price)}</span>
                {prod.oldPrice > prod.price && (
                  <span className="old-price">{formatPrice(prod.oldPrice)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MobileCampaignSpotlight;