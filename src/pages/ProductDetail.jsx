import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, FunnelIcon } from '@heroicons/react/24/outline';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [fallbackProducts, setFallbackProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch main product
  useEffect(() => {
    if (!slug || slug === 'undefined') {
      setError('Invalid product slug');
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/product/slug/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Product not found');
          }
          throw new Error('Failed to fetch product');
        }
        
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

  // Fetch similar products OR latest as fallback
  const fetchRelatedProducts = async () => {
    if (!product) return;

    setSimilarLoading(true);
    try {
      let url = '/api/homepage?limit=6';
      
      // Try similar first if brand/model available
      if (product.attributes?.brand) {
        url = `/api/homepage?brand=${encodeURIComponent(product.attributes.brand)}&limit=6&exclude=${product.id}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const products = data.latest || data.recommended || [];
        
        if (products.length > 0 && products[0].id !== product.id) {
          setSimilarProducts(products);
        } else {
          // Fallback to latest products
          const fallbackResponse = await fetch('/api/homepage?limit=6');
          const fallbackData = await fallbackResponse.json();
          setFallbackProducts(fallbackData.latest || fallbackData.recommended || []);
        }
      }
    } catch (err) {
      console.error('Related products fetch failed:', err);
      // Ultimate fallback - try homepage
      try {
        const fallbackResponse = await fetch('/api/homepage?limit=6');
        const fallbackData = await fallbackResponse.json();
        setFallbackProducts(fallbackData.latest || []);
      } catch {}
    } finally {
      setSimilarLoading(false);
    }
  };

  // Track view
  const trackView = async () => {
    if (product?.id) {
      try {
        await fetch(`/api/homepage/products/${product.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('View tracking failed:', err);
      }
    }
  };

  // Fetch related products after main product loads
  useEffect(() => {
    if (product) {
      trackView();
      const timer = setTimeout(fetchRelatedProducts, 300);
      return () => clearTimeout(timer);
    }
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse bg-white rounded-lg shadow p-8">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded-lg"></div>
              <div>
                <div className="h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded mb-6 w-1/2"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-8 text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Product not found'}</h2>
          <p className="text-gray-500 mb-8">The product you're looking for doesn't exist or has been removed.</p>
          <div className="space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Go Back
            </button>
            <Link to="/" className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center mb-8 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to products
        </button>

        {/* Main Product */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 lg:p-12">
            {/* Images */}
            <div className="space-y-4">
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-full h-96 lg:h-[500px] object-cover rounded-xl shadow-lg"
                  onError={(e) => { e.target.src = '/placeholder-image.jpg'; }}
                />
              )}
              {product.images?.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.slice(1, 5).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${product.title} ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-blue-500"
                      onError={(e) => { e.target.src = '/placeholder-image.jpg'; }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{product.title}</h1>
                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <span>ID: {product.id.slice(0, 8)}...</span>
                  <span className="mx-4">•</span>
                  <span>{product.views} views • {product.clicks_count} clicks</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  product.status === 'draft' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : product.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {product.status}
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                  ₦{product.price.toLocaleString()}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 w-24">Location:</span>
                    <span>{product.location.state}, {product.location.city}</span>
                  </div>
                  {product.attributes.brand && (
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 w-24">Brand:</span>
                      <span>{product.attributes.brand}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="prose max-w-none">
                <p className="text-gray-900 leading-relaxed">{product.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t">
                <div>
                  <h4 className="font-semibold mb-2">Contact Seller</h4>
                  <div className="space-y-1 text-sm">
                    <div>📱 {product.contact.phone}</div>
                    {product.contact.whatsapp && (
                      <a
                        href={`https://wa.me/${product.contact.whatsapp.replace(/D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-green-600 hover:text-green-700"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🎯 SIMILAR PRODUCTS - ALWAYS SHOWS */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 border-b">
            <h2 className="text-2xl font-bold text-gray-900">
              {similarProducts.length > 0 ? 'Similar Products' : 'Explore More Products'}
            </h2>
            <p className="text-gray-500 mt-1">
              {similarProducts.length > 0 
                ? `${product.attributes?.brand} ${product.attributes?.model} and similar items`
                : 'Check out these popular items'
              }
            </p>
          </div>

          {similarLoading ? (
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-64" />
              ))}
            </div>
          ) : similarProducts.length > 0 ? (
            // Show similar products
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {similarProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="group block overflow-hidden rounded-xl bg-gray-50 hover:bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-w-1 aspect-h-1 bg-gray-200 group-hover:bg-gray-100 overflow-hidden">
                    {item.images?.[0] && (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-gray-700">
                      {item.title}
                    </h3>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      ₦{item.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.location.state}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : fallbackProducts.length > 0 ? (
            // Show fallback products
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {fallbackProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="group block overflow-hidden rounded-xl bg-gray-50 hover:bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="aspect-w-1 aspect-h-1 bg-gray-200 group-hover:bg-gray-100 overflow-hidden">
                    {item.images?.[0] && (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-gray-700">
                      {item.title}
                    </h3>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      ₦{item.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.location.state}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            // Ultimate fallback - empty state
            <div className="p-12 text-center">
              <FunnelIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No products available right now</p>
              <Link
                to="/"
                className="mt-4 inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Browse all products
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;