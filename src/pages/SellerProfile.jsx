
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const SellerProfile = () => {
  const { id } = useParams();
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
          fetch(`/api/seller/${id}`),
          fetch(`/api/seller/${id}/stats`),
          fetch(`/api/seller/${id}/products?limit=12`)
        ]);

        if (!sellerRes.ok) throw new Error("Seller not found");
        if (!statsRes.ok) throw new Error("Failed to load seller stats");
        if (!productsRes.ok) throw new Error("Failed to load seller products");

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

    if (id) {
      fetchSeller();
    } else {
      setError("Seller ID missing");
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="loading-skeleton profile-skeleton p-8 text-center">
        <div className="skeleton w-24 h-24 rounded-full mx-auto mb-4 bg-gray-200"></div>
        <div className="skeleton h-6 w-60 mx-auto mb-2 bg-gray-200"></div>
        <div className="skeleton h-4 w-40 mx-auto mb-6 bg-gray-200"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">{error}</h2>
        <Link to="/" className="btn">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="seller-profile-page">
      {/* HEADER – Seller Banner */}
      <header className="seller-header-bg bg-gradient-to-b from-indigo-700 to-indigo-900 text-white p-6">
        <div className="homepage-container">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-indigo-300 flex items-center justify-center text-2xl font-bold">
              {seller.name?.charAt(0).toUpperCase() ||
               seller.email?.charAt(0).toUpperCase() ||
               "U"}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{seller.name}</h1>
              <p className="text-indigo-200 mb-1">
                {seller.store_name || "Independent Seller"} •{" "}
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
          {/* LEFT – PROFILE STATS + CONTACT */}
          <div className="lg:col-span-1">
            <div className="card profile-stats-card p-6">
              <h3 className="text-xl font-bold mb-4">Seller Stats</h3>
              <dl className="space-y-4">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Listings</dt>
                  <dd className="font-bold">{stats?.total_listings || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Sales</dt>
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

            {(seller.phone || seller.whatsapp) && (
              <div className="card mt-4 p-6">
                <h4 className="font-bold mb-2">Contact Seller</h4>
                <dl className="space-y-1 text-sm">
                  {seller.phone && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Phone</dt>
                      <dd>{seller.phone}</dd>
                    </div>
                  )}
                  {seller.whatsapp && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">WhatsApp</dt>
                      <dd>
                        <a
                          href={`https://wa.me/${seller.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600"
                        >
                          WhatsApp
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {seller.store_description && (
              <div className="card mt-4 p-6">
                <h4 className="font-bold mb-2">About Store</h4>
                <p className="text-gray-700 text-sm">
                  {seller.store_description}
                </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    className="product-card-link block"
                  >
                    <div className="card product-card h-full p-4">
                      <div className="card-image h-40 mb-3 overflow-hidden rounded-lg">
                        <img
                          src={
                            product.images?.[0] ||
                            "/api/placeholder/400/300"
                          }
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
                          {product.location_state || "Nigeria"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER (same pattern as ProductDetail) */}
        <footer className="product-footer mt-12">
          <div className="footer-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Browse Categories
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/category/electronics">Electronics</Link>
                  </li>
                  <li>
                    <Link to="/category/clothing">Fashion</Link>
                  </li>
                  <li>
                    <Link to="/category/homes">Home & Appliances</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Support
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/help">Help Center</Link>
                  </li>
                  <li>
                    <Link to="/terms">Terms & Policies</Link>
                  </li>
                  <li>
                    <Link to="/contact">Contact Us</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Company
                </h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/about">About Minimart</Link>
                  </li>
                  <li>
                    <Link to="/blog">Blog</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Follow Us
                </h3>
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