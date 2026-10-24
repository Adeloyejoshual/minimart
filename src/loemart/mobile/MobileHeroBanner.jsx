import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCampaigns, primaryImg } from './mobileHelpers';
import './styles/MobileHeroBanner.css';

const DEFAULT_SLIDES = [
  {
    id: 'flash-sale',
    badge: '🔥 LIMITED TIME',
    title: 'Flash Sale Deals',
    subtitle: 'Up to 70% off verified tech, phones & fashion',
    ctaText: 'Shop Deals',
    ctaLink: '/m/search?filter=flash',
    bgGradient: 'linear-gradient(135deg, #ff6000 0%, #d83b00 100%)',
    image: '/assets/banner-flash.png'
  },
  {
    id: 'campaign-verified',
    badge: '⭐ OFFICIAL MART',
    title: '100% Genuine Brands',
    subtitle: 'Direct warranty on all laptops, phones & appliances',
    ctaText: 'Explore Brand',
    ctaLink: '/m/search?q=official',
    bgGradient: 'linear-gradient(135deg, #111111 0%, #333333 100%)',
    image: '/assets/banner-brand.png'
  },
  {
    id: 'campaign-express',
    badge: '🚀 FAST DELIVERY',
    title: 'Loemart Express',
    subtitle: 'Same-day delivery available across major cities',
    ctaText: 'Order Now',
    ctaLink: '/m/search',
    bgGradient: 'linear-gradient(135deg, #2b1055 0%, #7597de 100%)',
    image: '/assets/banner-express.png'
  }
];

export default function MobileHeroBanner({ customSlides = null }) {
  const navigate = useNavigate();
  const [slides, setSlides] = useState(customSlides || DEFAULT_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const autoPlayTimerRef = useRef(null);

  // Fetch live campaign banners if available
  useEffect(() => {
    if (customSlides && customSlides.length > 0) {
      setSlides(customSlides);
      return;
    }

    let isMounted = true;
    async function loadCampaignSlides() {
      try {
        const liveCampaigns = await fetchCampaigns();
        if (isMounted && liveCampaigns && liveCampaigns.length > 0) {
          const campaignSlides = liveCampaigns.map((c) => ({
            id: c.id || c.slug,
            badge: '🎯 ACTIVE CAMPAIGN',
            title: c.title || c.name || 'Special Campaign',
            subtitle: c.subtitle || c.description || 'Exclusive hand-picked admin offers',
            ctaText: 'Shop Campaign',
            ctaLink: `/m/search?campaign=${encodeURIComponent(c.key || c.slug || c.title || c.name)}`,
            bgGradient: 'linear-gradient(135deg, #ff6000 0%, #b82200 100%)',
            image: c.banner || c.banner_url || c.image || '/assets/banner-campaign.png'
          }));

          setSlides([...campaignSlides, ...DEFAULT_SLIDES]);
        }
      } catch (e) {
        // Keep defaults on network error
      }
    }

    loadCampaignSlides();
    return () => { isMounted = false; };
  }, [customSlides]);

  // Autoplay cycle
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isPaused, slides.length]);

  const handleTouchStart = (e) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const swipeThreshold = 40;

    if (diff > swipeThreshold) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (diff < -swipeThreshold) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }

    setIsPaused(false);
  };

  const handleSlideClick = (slide) => {
    if (slide.ctaLink) {
      navigate(slide.ctaLink);
    }
  };

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <div className="mhb-container">
      <div
        className="mhb-slide"
        style={{
          background: currentSlide.bgGradient,
          backgroundImage: currentSlide.image && currentSlide.image !== '/placeholder.png'
            ? `linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 100%), url(${primaryImg(currentSlide.image)})`
            : currentSlide.bgGradient
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => handleSlideClick(currentSlide)}
      >
        <div className="mhb-content">
          {currentSlide.badge && (
            <span className="mhb-badge">{currentSlide.badge}</span>
          )}

          <h2 className="mhb-title">{currentSlide.title}</h2>
          <p className="mhb-subtitle">{currentSlide.subtitle}</p>

          <div className="mhb-cta-btn">
            <span>{currentSlide.ctaText || 'Shop Now'}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: '12px',
                height: '12px',
                minWidth: '12px',
                minHeight: '12px',
                maxWidth: '12px',
                maxHeight: '12px',
                flexShrink: 0,
                display: 'inline-block'
              }}
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        {/* Pagination Dots */}
        {slides.length > 1 && (
          <div className="mhb-dots">
            {slides.map((s, idx) => (
              <span
                key={s.id || idx}
                className={`mhb-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}