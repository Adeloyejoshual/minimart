import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import ProductHeader from "../components/ProductHeader";
import "../styles/ProductDetail.css";

const ProductDetail = () => {
  const { slug } = useParams();
  const similarEndRef = useRef(null);

  const [product, setProduct] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState(null);

  // FIX: Encoded slug used here for primary product fetch
  const fetchProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product slug");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/product/slug/${encodeURIComponent(slug)}`);
      if (!response.ok) {
        throw new Error(response.status === 404 ? "Product not found" : "Failed to fetch product");
      }
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // FIX: Ensure all subsequent dependent fetches also encode the slug
  const fetchReviews = useCallback(async () => {
    try {
      const response = await fetch(`/api/product/slug/${encodeURIComponent(slug)}/reviews?limit=5`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setReviewStats(data.stats);
      }
    } catch (err) { console.error("Reviews fetch failed:", err); }
  }, [slug]);

  useEffect(() => {
    if (product) {
      fetchReviews();
    }
  }, [product, fetchReviews]);

  // Add your remaining UI components (Gallery, Seller Card, etc.) below
  if (loading) return <div className="loading-skeleton">Loading...</div>;
  if (error) return <div className="error-state"><h2>{error}</h2><Link to="/">Browse Marketplace</Link></div>;

  return (
    <div className="product-detail-page">
      {product && <h1>{product.title}</h1>}
      {/* Add back your full gallery, attributes, and similar products grid here */}
    </div>
  );
};

export default ProductDetail;