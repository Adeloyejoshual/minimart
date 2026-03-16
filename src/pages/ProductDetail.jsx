// pages/product/[id].tsx
import { GetServerSideProps } from "next";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import TopNav from "../../components/TopNav";
import BottomNav from "../../components/BottomNav";
import TrendingCarousel from "../../components/TrendingCarousel";
import { fetchProductById, fetchTrending } from "../../services/api";
import "../styles/Homepage.css"; // Reuse the Homepage styles

interface ProductDetailProps {
  initialProduct: any;
  initialTrending: any[];
}

export default function ProductDetail({ initialProduct, initialTrending }: ProductDetailProps) {
  const router = useRouter();
  const { id } = router.query;

  // Fetch product data
  const productQuery = useQuery(
    ["product", id],
    () => fetchProductById(id as string),
    { initialData: initialProduct }
  );

  const trendingQuery = useQuery(["trending"], fetchTrending, {
    initialData: initialTrending,
  });

  const product = productQuery.data;

  if (!product) {
    return (
      <div className="enterprise-empty-state">
        <div className="empty-icon">📦</div>
        <h3>Product Not Found</h3>
        <p>Check back soon for new listings</p>
      </div>
    );
  }

  return (
    <div className="enterprise-homepage">
      <TopNav user={null} setUser={() => {}} />

      <section className="product-detail-section">
        <div className="product-detail-wrapper">
          <div className="product-image-container">
            {product.image ? (
              <img src={product.image} alt={product.title} className="card-image" />
            ) : (
              <div className="image-placeholder">📷</div>
            )}
          </div>

          <div className="product-detail-info">
            <h1 className="card-title">{product.title}</h1>
            <p className="card-description">{product.description}</p>
            <span className="price">₦{product.price?.toLocaleString()}</span>

            <button className="buy-btn">Buy Now</button>
          </div>
        </div>
      </section>

      {/* Recommended / Trending */}
      <TrendingCarousel
        trending={trendingQuery.data || []}
        onProductClick={(id) => router.push(`/product/${id}`)}
      />

      <BottomNav />
    </div>
  );
}

// SSR: Fetch product and trending
export const getServerSideProps: GetServerSideProps = async (context) => {
  const id = context.params?.id as string;
  const initialProduct = await fetchProductById(id);
  const initialTrending = await fetchTrending();

  return {
    props: {
      initialProduct,
      initialTrending,
    },
  };
};