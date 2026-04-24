// src/components/ProductDetail.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FunnelIcon, 
  UserIcon,
  ChatBubbleLeftIcon,
  ShieldCheckIcon,
  ArrowLongRightIcon
} from '@heroicons/react/24/outline';

import ProductHeader from "../components/ProductHeader";
import '../styles/ProductDetail.css';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const similarEndRef = useRef(null);
  
  // Core state only
  const [product, setProduct] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [similarPage, setSimilarPage] = useState(1);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);

  // Fetch product
  useEffect(() => {
    if (!slug || slug === 'undefined') {
      setError('Invalid product slug');
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/product/slug/${slug}`);
        if (!response.ok) throw new Error(response.status === 404 ? 'Product not found' : 'Failed to fetch product');
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  // Fetch similar products
  const fetchSimilarProducts = useCallback(async (page = 1, append = false) => {
    if (!product) return;
    
    try {
      const url = product.attributes?.brand 
        ? `/api/homepage?brand=${encodeURIComponent(product.attributes.brand)}&limit=12&page=${page}&exclude=${product.id}`
        : `/api/homepage?limit=12&page=${page}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const newProducts = (data.latest || data.recommended || [])
          .filter(p => p.id !== product.id && p.slug !== slug);
        
        setSimilarProducts(append ? [...similarProducts, ...newProducts] : newProducts);
        setHasMoreSimilar(newProducts.length === 12);
        setSimilarPage(page);
      }
    } catch (err) {
      console.error('Related products fetch failed:', err);
    }
  }, [product, slug, similarProducts]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreSimilar) {
          fetchSimilarProducts(similarPage + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    if (similarEndRef.current) observer.observe(similarEndRef.current);
    return () => observer.disconnect();
  }, [similarPage, hasMoreSimilar, fetchSimilarProducts]);

  // Fetch seller stats
  const fetchSellerStats = useCallback(async () => {
    if (!product?.contact?.email) return;
    try {
      const response = await fetch(`/api/product/slug/${slug}/seller-stats`);
      if (response.ok) setSellerStats(await response.json());
    } catch (err) {
      console.error('Seller stats failed:', err);
    }
  }, [product?.contact?.email, slug]);

  useEffect(() => {
    if (product && !error) {
      fetchSellerStats();
      fetchSimilarProducts(1, false);
    }
  }, [product, error, fetchSellerStats, fetchSimilarProducts]);

  if (loading) return <div className="loading-skeleton-premium">Loading...</div>;
  if (error) {
    return (
      <div className="error-state-premium min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md mx-auto">
          <h2 className="text-3xl font-black mb-8">{error}</h2>
          <Link to="/" className="premium-btn inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold">
            Browse Marketplace <ArrowLongRightIcon className="w-6 h-6" />
          </Link>
        </div>
      </div>
    );
  }

  const cleanPhone = (phone) => phone ? phone.replace(/[^+d]/g, '') : '';

  return (
    <div className="product-detail-premium min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
      <ProductHeader product={product} />
      
      <div className="homepage-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0">
        {/* Hero Section */}
        <div className="lg:grid-cols-2 gap-12 mb-20">
          {/* Main Image Only */}
          <div className="space-y-8">
            <div className="luxury-card overflow-hidden rounded-3xl shadow-2xl">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="w-full h-[500px] lg:h-[600px] object-cover hover:scale-105 transition-all duration-700"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-12">
            <div className="flex flex-wrap items-center gap-4 text-sm mb-6">
              <span>{product.clicks_count?.toLocaleString() || 0} views</span>
              <span>ID: {product.id.slice(0, 8)}...</span>
            </div>

            <div className="text-6xl font-black bg-gradient-to-r from-gray-900 to-purple-900 bg-clip-text text-transparent mb-8">
              ₦{Number(product.price || 0).toLocaleString()}
            </div>

            <div className="p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50">
              <div className="font-bold text-xl">{product.location_state}</div>
              <div className="text-sm text-gray-600">{product.location_city}</div>
            </div>

            {/* Contact */}
            <div className="luxury-card p-8 rounded-3xl" id="contact">
              <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                <ChatBubbleLeftIcon className="w-8 h-8" />
                Contact Seller
              </h3>
              <a
                href={`https://wa.me/${cleanPhone(product.contact?.whatsapp || product.contact?.phone)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="whatsapp-hero flex items-center gap-4 px-8 py-6 rounded-3xl font-black text-lg shadow-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              >
                💬 WhatsApp Chat
              </a>
            </div>
          </div>
        </div>

        {/* Seller Profile */}
        {sellerStats && (
          <div className="luxury-card mb-24 p-12 rounded-4xl">
            <div className="flex items-center gap-8 mb-12">
              <div className="w-28 h-28 bg-gradient-to-br from-orange-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl">
                <UserIcon className="w-14 h-14 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-black bg-gradient-to-r from-gray-900 to-slate-800 bg-clip-text text-transparent">
                  {sellerStats.store_name || 'Seller'}
                </h2>
                {sellerStats.verified_id && (
                  <div className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl font-black text-white mt-4">
                    <ShieldCheckIcon className="w-6 h-6" />
                    VERIFIED
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Similar Products */}
        <div className="luxury-card rounded-4xl overflow-hidden">
          <div className="p-12 border-b border-white/20">
            <h2 className="text-4xl font-black bg-gradient-to-r from-gray-900 to-slate-800 bg-clip-text text-transparent">
              Similar Products ({similarProducts.length})
            </h2>
          </div>
          
          <div className="p-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {similarProducts.map((item) => (
              <Link 
                key={item.id} 
                to={`/product/${item.slug}`} 
                className="luxury-card block h-96 rounded-3xl overflow-hidden hover:scale-[1.02] transition-all duration-500"
              >
                <div className="h-[65%] overflow-hidden">
                  <img
                    src={item.images?.[0] || '/api/placeholder/400/300'}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                  />
                </div>
                <div className="p-6 h-[35%] flex flex-col">
                  <h3 className="font-bold text-xl line-clamp-2 mb-4">{item.title}</h3>
                  <div className="text-2xl font-black bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent mb-4">
                    ₦{Number(item.price || 0).toLocaleString()}
                  </div>
                  <div>{item.location_state}</div>
                </div>
              </Link>
            ))}
          </div>

          {hasMoreSimilar && (
            <div ref={similarEndRef} className="p-12 flex justify-center">
              <button 
                onClick={() => fetchSimilarProducts(similarPage + 1, true)}
                className="px-12 py-6 rounded-3xl font-black bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xl hover:shadow-3xl"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;