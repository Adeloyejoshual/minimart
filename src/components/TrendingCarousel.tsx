// components/TrendingCarousel.tsx
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import ProductCardEnterprise from "./ProductCardEnterprise";

interface TrendingCarouselProps {
  trending: any[];
  onProductClick: (id: string) => void;
}

const TrendingCarousel: React.FC<TrendingCarouselProps> = ({
  trending,
  onProductClick,
}) => {
  if (!trending || trending.length === 0) return null;

  return (
    <section className="trending-section">
      <h2 className="section-title">🔥 Top Trending</h2>
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        slidesPerView={2}
        spaceBetween={16}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        className="enterprise-swiper"
        breakpoints={{
          360: { slidesPerView: 2, spaceBetween: 12 },
          769: { slidesPerView: 3, spaceBetween: 20 },
          1025: { slidesPerView: 4, spaceBetween: 24 },
          1367: { slidesPerView: 5, spaceBetween: 24 },
          1681: { slidesPerView: 6, spaceBetween: 28 },
          1921: { slidesPerView: 7, spaceBetween: 30 },
        }}
      >
        {trending.map((product) => (
          <SwiperSlide key={product.id || product._id}>
            <ProductCardEnterprise
              product={product}
              onClick={() => onProductClick(product.id || product._id)}
              variant="trending"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default TrendingCarousel;