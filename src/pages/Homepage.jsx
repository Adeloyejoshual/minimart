// pages/Homepage 
import { GetServerSideProps } from "next";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import ProductCardEnterprise from "../components/ProductCardEnterprise";
import TrendingCarousel from "../components/TrendingCarousel";
import { fetchProducts, fetchTrending } from "../services/api";
import useDebounce from "../hooks/useDebounce";
import "../styles/Homepage.css"; // Import the CSS

interface HomepageProps {
  initialTrending: any[];
  initialProducts: any[];
}

export default function Homepage({ initialTrending, initialProducts }: HomepageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Trending Products
  const trendingQuery = useQuery(["trending"], fetchTrending, {
    initialData: initialTrending,
  });

  // Infinite Products
  const productsQuery = useInfiniteQuery(
    ["products", debouncedSearch],
    ({ pageParam = 0 }) => fetchProducts({ skip: pageParam, search: debouncedSearch }),
    {
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === 20 ? allPages.flat().length : undefined,
      initialData: { pages: [initialProducts], pageParams: [0] },
      keepPreviousData: true,
    }
  );

  const products = productsQuery.data?.pages.flat() || [];

  const handleProductClick = (id: string) => {
    window.location.href = `/product/${id}`;
  };

  return (
    <div className="enterprise-homepage">
      {/* Top Navigation */}
      <TopNav user={null} setUser={() => {}} />

      {/* Hero Section */}
      <header className="enterprise-hero">
        <div className="hero-content">
          <h1>Enterprise Marketplace</h1>
          <p>Scale your business with millions of products</p>
        </div>
      </header>

      {/* Trending Carousel */}
      <TrendingCarousel
        trending={trendingQuery.data || []}
        onProductClick={handleProductClick}
      />

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Products Infinite Scroll */}
      <section className="products-section">
        <div className="section-header">
          <h2>All Products ({products.length})</h2>
        </div>

        {productsQuery.isError && (
          <div className="error-banner">
            <span>Failed to load products.</span>
            <button onClick={() => productsQuery.refetch()} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        <InfiniteScroll
          dataLength={products.length}
          next={productsQuery.fetchNextPage}
          hasMore={!!productsQuery.hasNextPage}
          loader={<div className="enterprise-loader">Loading products...</div>}
        >
          <div className="enterprise-grid">
            {products.map((product) => (
              <ProductCardEnterprise
                key={product.id || product._id}
                product={product}
                onClick={() => handleProductClick(product.id || product._id)}
              />
            ))}
          </div>
        </InfiniteScroll>

        {products.length === 0 && !productsQuery.isFetching && (
          <div className="enterprise-empty-state">
            <div className="empty-icon">📦</div>
            <h3>No Products Available</h3>
            <p>Check back soon for new listings</p>
          </div>
        )}
      </section>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

// SSR: Preload trending and first page of products
export const getServerSideProps: GetServerSideProps = async () => {
  const initialTrending = await fetchTrending();
  const initialProducts = await fetchProducts({ skip: 0, limit: 20 });

  return {
    props: {
      initialTrending,
      initialProducts,
    },
  };
};