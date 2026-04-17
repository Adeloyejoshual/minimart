import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://minimart-ivrm.onrender.com';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const imageRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/product/${slug}`, {
          headers: {
            'X-Client': 'web',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          setData(result);
        } else {
          setError(result.message || 'Product not found');
        }
      } catch (err) {
        console.error('[ProductDetail]', err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  const handleImageZoom = useCallback((e) => {
    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    img.style.transformOrigin = `${x}px ${y}px`;
    img.style.transform = 'scale(2)';
  }, []);

  const handleImageLeave = () => {
    const img = imageRef.current;
    if (img) img.style.transform = 'scale(1)';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse mb-8 lg:mb-0" />
          <div>
            <div className="h-8 bg-gray-200 rounded-lg mb-4 animate-pulse" />
            <div className="h-12 bg-gray-200 rounded-lg mb-6 animate-pulse" />
            <div className="space-y-3 mb-8">
              <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
              <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Product not found'}</h1>
          <Link 
            to="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to homepage
          </Link>
        </div>
      </div>
    );
  }

  const { product, related = [], seller } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            to="/"
            className="flex items-center text-sm text-gray-500 hover:text-gray-700 py-4"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to products
          </Link>
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:grid lg:grid-cols-2 lg:gap-x-8">
        <section className="lg:row-span-3">
          <div className="sticky top-6">
            {product.images.length > 0 && (
              <div 
                ref={imageRef}
                className="group relative w-full h-96 md:h-[500px] bg-gray-200 rounded-xl overflow-hidden cursor-zoom-in"
                onMouseMove={handleImageZoom}
                onMouseLeave={handleImageLeave}
              >
                <img
                  src={product.images[currentImage]}
                  alt={product.title}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                {product.images.length > 1 && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/50 rounded-lg p-2">
                    <div className="flex gap-2 overflow-x-auto">
                      {product.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImage(idx)}
                          className={`w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                            currentImage === idx 
                              ? 'border-blue-500 ring-2 ring-blue-500' 
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <img src={img} alt={`${product.title} ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="lg:pr-8">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl mb-2">
              {product.title}
            </h1>
            
            <div className="flex items-baseline mb-6">
              <span className="text-3xl font-bold text-gray-900">
                ₦{product.price?.toLocaleString()}
              </span>
              {product.promotion && (
                <span className="ml-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                  PROMOTED
                </span>
              )}
            </div>

            <div className="flex items-center text-sm text-gray-500 mb-6">
              <MapPinIcon className="w-5 h-5 mr-1" />
              {product.location.state}, {product.location.city}
              <span className="mx-4">•</span>
              <span>👁️ {product.views.toLocaleString()} views</span>
            </div>

            {Object.keys(product.attributes || {}).length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-6 text-sm">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="bg-white p-3 rounded-lg border">
                    <span className="text-gray-500 capitalize">{key}:</span>
                    <span className="font-medium ml-1">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {seller && (
              <div className="bg-white p-6 rounded-xl border mb-6">
                <h3 className="font-semibold text-lg mb-4">Contact Seller</h3>
                <div className="space-y-3">
                  <a
                    href={`https://wa.me/${seller.phone.replace(/D/g, '')}?text=Hi, I'm interested in your ${product.title} (₦${product.price?.toLocaleString()}). Available?`}
                    className="w-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-medium transition-all"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    💬 WhatsApp Chat
                  </a>
                  <a
                    href={`tel:${seller.phone}`}
                    className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-all"
                  >
                    <PhoneIcon className="w-5 h-5 mr-2" />
                    Call {seller.phone}
                  </a>
                </div>
              </div>
            )}

            {product.delivery?.available && (
              <div className="bg-green-50 p-4 rounded-xl mb-6">
                <h4 className="font-medium text-green-900 mb-2">Delivery Available</h4>
                <p className="text-sm text-green-800">
                  {product.delivery.duration.from}-{product.delivery.duration.to} days • 
                  Fee: ₦{product.delivery.fee?.toLocaleString() || 'Free'}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {related.map((item) => (
                <Link key={item.id} to={`/product/${item.slug}`} className="group">
                  <div className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-xl transition-all">
                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      {item.images[0] ? (
                        <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="text-gray-400 text-sm">No image</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">{item.title}</h3>
                      <p className="text-lg font-bold text-gray-900">
                        ₦{item.price?.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">👁️ {item.views || 0} views</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}