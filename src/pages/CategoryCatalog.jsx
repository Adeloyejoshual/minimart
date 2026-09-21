/**
 * src/pages/CategoryCatalog.jsx
 *
 * Routes:
 * /catalog
 * /loemart/explore
 * /loemart/new
 * /loemart/trending
 * /loemart/deals
 *
 * Query:
 * ?category=slug
 * ?brand=Name
 * ?q=search
 * ?sort=newest
 */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import {
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";

import axios from "axios";

import {
  formatPrice,
  getProductImage,
  calcDiscount,
} from "../config/marketplace";

import "../styles/CategoryCatalog.css";


/* ─────────────────────────────────────────────────────────────
   API
───────────────────────────────────────────────────────────── */

const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL || "";

const API_ROOT = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api";

const PRODUCTS_URL =
  `${API_ROOT}/products`;


/* ─────────────────────────────────────────────────────────────
   Icons
───────────────────────────────────────────────────────────── */

const Icon = {
  search: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={18}
      height={18}
    >
      <circle cx="11" cy="11" r="8" />
      <line
        x1="21"
        y1="21"
        x2="16.65"
        y2="16.65"
      />
    </svg>
  ),

  heart: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={18}
      height={18}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),

  heartFilled: (
    <svg
      viewBox="0 0 24 24"
      fill="#ff5722"
      stroke="#ff5722"
      strokeWidth={2}
      width={18}
      height={18}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),

  star: (
    <svg
      viewBox="0 0 24 24"
      fill="#f59e0b"
      width={12}
      height={12}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),

  chevronDown: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={14}
      height={14}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),

  sort: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
    </svg>
  ),

  filter: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width={16}
      height={16}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),

  back: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      width={20}
      height={20}
    >
      <line
        x1="19"
        y1="12"
        x2="5"
        y2="12"
      />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};


/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

function titleCase(str) {
  return String(str || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

function pickRating(product) {
  const rating = Number(
    product?.rating ??
    product?.average_rating ??
    0
  );

  return rating > 0 ? rating : null;
}


/* ─────────────────────────────────────────────────────────────
   Discovery configuration
───────────────────────────────────────────────────────────── */

const DISCOVERY_MODES = {
  explore: {
    title: "Explore Listings",
    description:
      "Discover products and listings from sellers on Loemart.",
    sort: "newest",
  },

  new: {
    title: "New Listings",
    description:
      "Browse the latest products and listings recently added to Loemart.",
    sort: "newest",
  },

  trending: {
    title: "Trending",
    description:
      "Explore listings getting attention from shoppers on Loemart.",
    sort: "trending",
  },

  deals: {
    title: "Deals",
    description:
      "Discover listings currently available at reduced prices.",
    sort: "deals",
  },
};


/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */

export default function CategoryCatalog() {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchParams] =
    useSearchParams();

  const categorySlug =
    searchParams.get("category") || "";

  const brandParam =
    searchParams.get("brand") || "";

  const searchQuery =
    searchParams.get("q") || "";

  const sortParam =
    searchParams.get("sort") || "";


  /* Determine discovery page */

  const discoveryMode = useMemo(() => {
    const path = location.pathname;

    if (path === "/loemart/new") {
      return "new";
    }

    if (path === "/loemart/trending") {
      return "trending";
    }

    if (path === "/loemart/deals") {
      return "deals";
    }

    if (path === "/loemart/explore") {
      return "explore";
    }

    return null;
  }, [location.pathname]);


  const discovery =
    discoveryMode
      ? DISCOVERY_MODES[discoveryMode]
      : null;


  const effectiveSort =
    sortParam ||
    discovery?.sort ||
    "newest";


  /* Products */

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [showMoreSeo, setShowMoreSeo] =
    useState(false);


  /* Wishlist */

  const [wishlist, setWishlist] =
    useState(() => {
      try {
        return new Set(
          JSON.parse(
            localStorage.getItem(
              "mm_wishlist"
            ) || "[]"
          )
        );
      } catch {
        return new Set();
      }
    });


  /* Page title */

  const displayTitle = useMemo(() => {
    if (discovery) {
      return discovery.title;
    }

    if (brandParam) {
      return titleCase(brandParam);
    }

    if (categorySlug) {
      return titleCase(categorySlug);
    }

    if (searchQuery) {
      return `“${searchQuery}”`;
    }

    return "All Products";
  }, [
    discovery,
    brandParam,
    categorySlug,
    searchQuery,
  ]);


  /* Description */

  const pageDescription = useMemo(() => {
    if (discovery) {
      return discovery.description;
    }

    if (brandParam || categorySlug) {
      return `Explore ${displayTitle} on Loemart Nigeria.`;
    }

    if (searchQuery) {
      return `Search results for ${displayTitle}.`;
    }

    return "Explore products and listings on Loemart.";
  }, [
    discovery,
    displayTitle,
    brandParam,
    categorySlug,
    searchQuery,
  ]);


  /* ───────────────────────────────────────────────────────────
     Fetch products
  ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    const params = {
      page: 1,
      limit: 48,
      sort: effectiveSort || undefined,
    };


    if (categorySlug) {
      params.category = categorySlug;
      params.category_slug = categorySlug;
      params.slug = categorySlug;
    }


    if (brandParam) {
      params.brand = brandParam;
      params.brand_name = brandParam;
    }


    if (searchQuery) {
      params.q = searchQuery;
      params.search = searchQuery;
    }


    axios
      .get(PRODUCTS_URL, {
        params,
        timeout: 15000,
      })
      .then(({ data }) => {
        if (cancelled) return;

        const list =
          data?.data?.products ??
          data?.data?.items ??
          data?.data ??
          data?.products ??
          data?.items ??
          (Array.isArray(data)
            ? data
            : []);

        setProducts(
          Array.isArray(list)
            ? list
            : []
        );
      })
      .catch((err) => {
        console.error(
          "[CategoryCatalog] Fetch error:",
          err
        );

        if (!cancelled) {
          setProducts([]);

          setError(
            err?.response?.status === 404
              ? "not_found"
              : "error"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });


    return () => {
      cancelled = true;
    };
  }, [
    categorySlug,
    brandParam,
    searchQuery,
    effectiveSort,
  ]);


  /* ───────────────────────────────────────────────────────────
     Deals fallback
  ─────────────────────────────────────────────────────────── */

  const visibleProducts = useMemo(() => {
    if (discoveryMode !== "deals") {
      return products;
    }

    return products.filter((product) => {
      const price = Number(
        product.price ??
        product.sale_price ??
        product.selling_price ??
        0
      );

      const originalPrice = Number(
        product.original_price ||
        product.compare_price ||
        product.list_price ||
        0
      );

      return (
        originalPrice > 0 &&
        price > 0 &&
        originalPrice > price
      );
    });
  }, [
    products,
    discoveryMode,
  ]);


  /* ───────────────────────────────────────────────────────────
     Wishlist
  ─────────────────────────────────────────────────────────── */

  const toggleWishlist = useCallback(
    (id, event) => {
      event.stopPropagation();

      setWishlist((previous) => {
        const next = new Set(previous);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        try {
          localStorage.setItem(
            "mm_wishlist",
            JSON.stringify([
              ...next,
            ])
          );
        } catch {
          /* Ignore storage errors */
        }

        return next;
      });
    },
    []
  );


  /* ───────────────────────────────────────────────────────────
     Product navigation
  ─────────────────────────────────────────────────────────── */

  const goProduct = useCallback(
    (product) => {
      navigate(
        `/shop/${
          product.slug ||
          product.id
        }`
      );
    },
    [navigate]
  );


  return (
    <div className="jumia-cat-page">

      {/* Header */}

      <header className="jumia-cat-header">

        <button
          type="button"
          className="jumia-cat-back"
          onClick={() =>
            navigate(-1)
          }
          aria-label="Back"
        >
          {Icon.back}
        </button>


        <div
          className="jumia-search-bar"
          onClick={() =>
            navigate("/search")
          }
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              navigate("/search");
            }
          }}
        >
          {Icon.search}

          <span>
            Search products, brands...
          </span>
        </div>

      </header>


      {/* Breadcrumb */}

      <nav
        className="jumia-breadcrumbs"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          onClick={() =>
            navigate("/loemart")
          }
        >
          Home
        </button>

        <span className="sep">
          &gt;
        </span>

        <span className="current">
          {displayTitle}
        </span>
      </nav>


      {/* Filter pills */}

      <div className="jumia-filter-pills">

        <button
          type="button"
          className="pill"
        >
          Brand {Icon.chevronDown}
        </button>

        <button
          type="button"
          className="pill"
        >
          Price {Icon.chevronDown}
        </button>

        <button
          type="button"
          className="pill"
        >
          Rating {Icon.chevronDown}
        </button>

      </div>


      {/* Discovery heading */}

      <div className="jumia-seo-block">

        <h1 className="jumia-seo-title">
          {displayTitle.toUpperCase()}
        </h1>

        <p
          className={`jumia-seo-text ${
            showMoreSeo
              ? "jumia-seo-text--open"
              : ""
          }`}
        >
          {pageDescription}
        </p>

        <button
          type="button"
          className="jumia-seo-more"
          onClick={() =>
            setShowMoreSeo(
              (value) => !value
            )
          }
        >
          {showMoreSeo
            ? "See less ▲"
            : "See more ▼"}
        </button>

      </div>


      {/* Products */}

      <main className="jumia-grid-wrap">

        {loading ? (

          <div className="jumia-grid-skel">
            {[
              1,
              2,
              3,
              4,
              5,
              6,
            ].map((item) => (
              <div
                key={item}
                className="jumia-skel-card"
              />
            ))}
          </div>

        ) : error &&
          visibleProducts.length === 0 ? (

          <div className="jumia-empty">

            <p>
              Could not load listings.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/loemart"
                )
              }
            >
              Browse All Items
            </button>

          </div>

        ) : visibleProducts.length === 0 ? (

          <div className="jumia-empty">

            <p>
              {discoveryMode === "deals"
                ? "No discounted listings are available right now."
                : `No listings found for ${displayTitle}.`}
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/loemart/explore"
                )
              }
            >
              Explore Listings
            </button>

          </div>

        ) : (

          <div className="jumia-product-grid">

            {visibleProducts.map(
              (product) => {

                const displayPrice =
                  Number(
                    product.price ??
                    product.sale_price ??
                    product.selling_price ??
                    0
                  );

                const originalPrice =
                  Number(
                    product.original_price ||
                    product.compare_price ||
                    product.list_price ||
                    0
                  );

                const discount =
                  calcDiscount(
                    displayPrice,
                    originalPrice
                  );

                const isSaved =
                  wishlist.has(
                    product.id
                  );

                const rating =
                  pickRating(
                    product
                  );

                const reviewsCount =
                  product.reviews_count ??
                  product.rating_count ??
                  0;

                const image =
                  getProductImage(
                    product
                  );


                return (
                  <div
                    key={product.id}
                    className="jumia-product-card"
                    onClick={() =>
                      goProduct(
                        product
                      )
                    }
                    role="link"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        goProduct(
                          product
                        );
                      }
                    }}
                  >

                    <div className="jumia-card__img-wrap">

                      {discount > 0 && (
                        <span className="jumia-card__discount">
                          -{discount}%
                        </span>
                      )}

                      {image ? (
                        <img
                          src={image}
                          alt={
                            product.name
                          }
                          loading="lazy"
                        />
                      ) : (
                        <div className="jumia-card__img-ph">
                          📦
                        </div>
                      )}

                      <button
                        type="button"
                        className="jumia-card__wish"
                        onClick={(event) =>
                          toggleWishlist(
                            product.id,
                            event
                          )
                        }
                        aria-label="Wishlist"
                      >
                        {isSaved
                          ? Icon.heartFilled
                          : Icon.heart}
                      </button>

                    </div>


                    <div className="jumia-card__body">

                      {product.is_official && (
                        <span className="jumia-card__badge-official">
                          Official Store
                        </span>
                      )}

                      <h3 className="jumia-card__title">
                        {product.name}
                      </h3>


                      <div className="jumia-card__price-row">

                        <span className="jumia-card__price">
                          {formatPrice(
                            displayPrice
                          )}
                        </span>

                        {originalPrice >
                          displayPrice && (
                          <span className="jumia-card__orig">
                            {formatPrice(
                              originalPrice
                            )}
                          </span>
                        )}

                      </div>


                      {rating != null && (
                        <div className="jumia-card__rating">
                          {Icon.star}

                          <span className="num">
                            {rating.toFixed(
                              1
                            )}
                          </span>

                          {reviewsCount >
                            0 && (
                            <span className="count">
                              (
                              {
                                reviewsCount
                              }
                              )
                            </span>
                          )}
                        </div>
                      )}


                      {discount > 0 && (
                        <span className="jumia-card__express">
                          🏷️ DEAL
                        </span>
                      )}


                      <button
                        type="button"
                        className="jumia-card__add-btn"
                        onClick={(event) => {
                          event.stopPropagation();

                          goProduct(
                            product
                          );
                        }}
                      >
                        View
                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </main>


      {/* Floating controls */}

      <div className="jumia-floating-pill">

        <button
          type="button"
          className="jumia-fp-btn"
        >
          {Icon.sort}
          Sort by
        </button>

        <span className="jumia-fp-divider" />

        <button
          type="button"
          className="jumia-fp-btn"
        >
          {Icon.filter}
          Filter
        </button>

      </div>

    </div>
  );
}