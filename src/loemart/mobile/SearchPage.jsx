import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MasonryCard from './MasonryCard';
import BottomNav from '../../components/BottomNav';
import {
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  TRENDING_SEARCHES,
  haptic,
  normalize,
  fetchProducts,
  filterProductsByCampaign
} from './mobileHelpers';
import './styles/SearchPage.css';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryFromUrl = searchParams.get('q') || '';
  const categoryFromUrl = searchParams.get('category') || '';
  const campaignFromUrl = searchParams.get('campaign') || '';
  const filterFromUrl = searchParams.get('filter') || '';

  const [searchTerm, setSearchTerm] = useState(queryFromUrl);
  const [activeCategory, setActiveCategory] = useState(categoryFromUrl);
  const [activeCampaign, setActiveCampaign] = useState(campaignFromUrl);
  const [sortBy, setSortBy] = useState('relevance');

  const [history, setHistory] = useState(getSearchHistory());
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sync state with URL params
  useEffect(() => {
    setSearchTerm(queryFromUrl);
    setActiveCategory(categoryFromUrl);
    setActiveCampaign(campaignFromUrl);
  }, [queryFromUrl, categoryFromUrl, campaignFromUrl]);

  // Load catalog on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      setLoading(true);
      try {
        const items = await fetchProducts();
        if (isMounted) setAllProducts(items);
      } catch (err) {
        console.error('Failed to load search catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // Filter & Sort Logic
  useEffect(() => {
    let result = [...allProducts];

    // 1. Search term filter
    if (searchTerm.trim()) {
      const term = normalize(searchTerm).toLowerCase();
      result = result.filter(item => {
        const title = normalize(item.title || item.name).toLowerCase();
        const desc = normalize(item.description).toLowerCase();
        const cat = normalize(item.category || item.category_name).toLowerCase();
        return title.includes(term) || desc.includes(term) || cat.includes(term);
      });
    }

    // 2. Category filter
    if (activeCategory && activeCategory !== 'All') {
      const cat = normalize(activeCategory).toLowerCase();
      result = result.filter(item => normalize(item.category || item.category_name).toLowerCase() === cat);
    }

    // 3. Campaign filter
    if (activeCampaign) {
      result = filterProductsByCampaign(result, activeCampaign);
    }

    // 4. Flash sale filter tag
    if (filterFromUrl === 'flash') {
      result = result.filter(item => {
        const p = Number(item.price || item.selling_price || item.sale_price || 0);
        const op = Number(item.old_price || item.original_price || item.regular_price || 0);
        return op > p && p > 0;
      });
    }

    // 5. Sorting
    if (sortBy === 'price_asc') {
      result.sort((a, b) => Number(a.price || a.selling_price || 0) - Number(b.price || b.selling_price || 0));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => Number(b.price || b.selling_price || 0) - Number(a.price || a.selling_price || 0));
    } else if (sortBy === 'trending') {
      result = result.filter(i => i.is_trending || i.trending);
    }

    setFilteredProducts(result);
  }, [allProducts, searchTerm, activeCategory, activeCampaign, filterFromUrl, sortBy]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;
    haptic(15);
    addToSearchHistory(searchTerm.trim());
    setHistory(getSearchHistory());
    setSearchParams({ q: searchTerm.trim() });
  };

  const handleClearAllFilters = () => {
    haptic(10);
    setSearchTerm('');
    setActiveCategory('');
    setActiveCampaign('');
    setSearchParams({});
  };

  return (
    <div className="sp-page-container">
      {/* Search Bar Header */}
      <div className="sp-header">
        <button className="sp-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <form className="sp-search-form" onSubmit={handleSearchSubmit}>
          <svg className="sp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="sp-search-input"
            placeholder="Search products, campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          {searchTerm && (
            <button type="button" className="sp-clear-input" onClick={() => setSearchTerm('')}>
              &times;
            </button>
          )}
        </form>
      </div>

      {/* Active Filter Chips */}
      {(searchTerm || activeCategory || activeCampaign || filterFromUrl) && (
        <div className="sp-active-filters-bar">
          <span className="sp-filter-label">Active:</span>
          {searchTerm && (
            <span className="sp-filter-chip">
              "{searchTerm}"
              <button onClick={() => { setSearchTerm(''); setSearchParams({}); }}>&times;</button>
            </span>
          )}
          {activeCategory && (
            <span className="sp-filter-chip">
              Cat: {activeCategory}
              <button onClick={() => { setActiveCategory(''); setSearchParams({}); }}>&times;</button>
            </span>
          )}
          {activeCampaign && (
            <span className="sp-filter-chip mc-campaign-chip">
              🎯 Campaign: {activeCampaign}
              <button onClick={() => { setActiveCampaign(''); setSearchParams({}); }}>&times;</button>
            </span>
          )}
          {filterFromUrl === 'flash' && (
            <span className="sp-filter-chip">
              ⚡ Flash Sale
              <button onClick={() => setSearchParams({})}>&times;</button>
            </span>
          )}
          <button className="sp-reset-all" onClick={handleClearAllFilters}>
            Clear All
          </button>
        </div>
      )}

      {/* Search History & Trending Chips when empty */}
      {!searchTerm && !activeCategory && !activeCampaign && !filterFromUrl && (
        <div className="sp-suggestions-body">
          {history.length > 0 && (
            <div className="sp-section">
              <div className="sp-section-title">
                <span>Recent Searches</span>
                <button className="sp-clear-btn" onClick={() => { clearSearchHistory(); setHistory([]); }}>Clear</button>
              </div>
              <div className="sp-chips-grid">
                {history.map((term, idx) => (
                  <button key={idx} className="sp-chip" onClick={() => { setSearchTerm(term); setSearchParams({ q: term }); }}>
                    🕒 {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sp-section">
            <div className="sp-section-title">
              <span>🔥 Trending Searches</span>
            </div>
            <div className="sp-chips-grid">
              {TRENDING_SEARCHES.map((term, idx) => (
                <button key={idx} className="sp-chip sp-chip-trending" onClick={() => { setSearchTerm(term); setSearchParams({ q: term }); }}>
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="sp-results-area">
        <div className="sp-results-header">
          <span className="sp-count">{filteredProducts.length} Products</span>
          <select
            className="sp-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="relevance">Sort: Relevant</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="trending">Trending First</option>
          </select>
        </div>

        {loading ? (
          <div className="sp-masonry-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ height: '220px', background: '#e0e0e0', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="sp-empty-state">
            <h3>No matching products</h3>
            <p>Try searching with different keywords or clear your active campaign filters.</p>
            <button className="sp-reset-btn" onClick={handleClearAllFilters}>Reset Filters</button>
          </div>
        ) : (
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {filteredProducts.map((product) => (
              <MasonryCard key={product.id || product.product_id} product={product} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}