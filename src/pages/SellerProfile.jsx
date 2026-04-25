
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const SellerProfile = () => {
  const { sellerId } = useParams();
  const [seller, setSeller] = useState(null);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        setLoading(true);
        setError(null);

        const [sellerRes, statsRes, productsRes] = await Promise.all([
          fetch(`/api/seller/${sellerId}`),
          fetch(`/api/seller/${sellerId}/stats`),
          fetch(`/api/seller/${sellerId}/products?limit=12`)
        ]);

        if (!sellerRes.ok) throw new Error("Seller not found");
        if (!statsRes.ok) throw new Error("Failed to load stats");
        if (!productsRes.ok) throw new Error("Failed to load products");

        const sellerData     = await sellerRes.json();
        const statsData      = await statsRes.json();
        const productsData   = await productsRes.json();

        setSeller(sellerData);
        setStats(statsData);
        setProducts(productsData.products || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (sellerId) {
      fetchSeller();
    } else {
      setError("Missing seller ID");
      setLoading(false);
    }
  }, [sellerId]);

  if (loading) {
    return (
      <div className="loading-skeleton profile-skeleton">
        <div className="skeleton h-24 w-24 rounded-full mb-4"></div>
        <div className="skeleton h-8 w-60 mb-2"></div>
        <div className="skeleton h-6 w-40 mb-4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-content">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{error}</h2>
          <Link to="/" className="btn">Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-profile-page">
      {/* HEADER / SELLER INFO */}
      <header className="seller-header-bg bg-gradient-to-b from-indigo-700 to-indigo-900 text-white p-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-6">
            <div className="avatar-large">
              <div className="w-24 h-24 rounded-full bg-indigo-300 flex items-center justify-center">
                {seller.name?.charAt(0)?.toUpperCase() || seller.email?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">{seller.name || seller.email}</h1>
              <p className="text-indigo-200 mb-2">
                Member since {new Date(seller.created_at).toLocaleDateString()}
              </p>
              <div className="text-sm text-indigo-200">
                {stats?.total_listings || 0} listings •{" "}
                {stats?.total_sales || 0} sales
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="homepage-container profile-container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT – PROFILE STATS */}
          <div className="lg:col-span-1">
            <div className="card profile-stats-card">
              <h3 className="text-xl font-bold mb-4">Seller Stats</h3>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Total listings</dt>
                  <dd className="font-bold">{stats?.total_listings || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Completed sales</dt>
                  <dd className="font-bold">{stats?.total_sales || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Avg. rating</dt>
                  <dd className="flex items-center gap-1">
                    <span className="font-bold">
                      {Number(stats?.avg_rating || 0).toFixed(1)}
                    </span>
                    <span className="text-yellow-500">★</span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Rating count</dt>
                  <dd className="font-bold">{stats?.rating_count || 0}</dd>
                </div>
              </dl>
            </div>

            {seller.phone && (
              <div className="card mt-4">
                <h4 className="font-bold mb-2">Contact</h4>
                <div className="text-sm">
                  <p>Phone: {seller.phone}</p>
                  {seller.whatsapp && (
                    <p className="whatsapp-link">
                      <a
                        href={`https://wa.me/${seller.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600"
                      >
                        WhatsApp
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT – LISTED PRODUCTS */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {seller.name || "Seller"}'s Listings
              </h2>
              <p className="text-gray-600">
                {products.length} active products • {stats?.total_listings || 0} total
              </p>
            </div>

            {products.length === 0 ? (
              <div className="text-center p-10 text-gray-600">
                This seller has no active listings yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    className="product-card-link"
                  >
                    <div className="card product-card">
                      <div className="card-image h-40 mb-3 overflow-hidden rounded-lg">
                        <img
                          src={product.images?.[0] || "/api/placeholder/400/300"}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "/api/placeholder/400/300";
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 mb-1">
                          {product.title}
                        </h3>
                        <p className="text-indigo-600 font-bold mb-1">
                          ₦{Number(product.price || 0).toLocaleString()}
                        </p>
                        <div className="text-xs text-gray-600">
                          {product.location_state}, {product.location_city}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER (same style as ProductDetail) */}
        <footer className="product-footer mt-12">
          <div className="footer-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Browse Categories</h3>
                <ul className="space-y-2">
                  <li><Link to="/category/electronics">Electronics</Link></li>
                  <li><Link to="/category/clothing">Fashion</Link></li>
                  <li><Link to="/category/homes">Home & Appliances</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Support</h3>
                <ul className="space-y-2">
                  <li><Link to="/help">Help Center</Link></li>
                  <li><Link to="/terms">Terms & Policies</Link></li>
                  <li><Link to="/contact">Contact Us</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><Link to="/about">About Minimart</Link></li>
                  <li><Link to="/blog">Blog</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Follow Us</h3>
                <div className="flex gap-4">
                  <Link to="#">Twitter</Link>
                  <Link to="#">Instagram</Link>
                  <Link to="#">Facebook</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SellerProfile;