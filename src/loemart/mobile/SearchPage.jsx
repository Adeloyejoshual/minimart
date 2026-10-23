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
  normalize
} from './mobileHelpers';
import './styles/SearchPage.css';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryFromUrl = searchParams.get('q') || '';
  const categoryFromUrl = searchParams.get('category') || '';
  const campaignFromUrl = searchParams.get('campaign') || '';

  const [searchTerm, setSearchTerm] = useState(queryFromUrl);
  const [activeCategory, setActiveCategory] = useState(categoryFromUrl);
  const [activeCampaign, setActiveCampaign] = useState(campaignFromUrl);
  const [sortBy, setSortBy] = useState('relevance');

  const [history, setHistory] = useState(getSearchHistory());
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Fetch product catalog on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.products || data.data || []);
          setAllProducts(items);

          const uniqueCats = Array.from(
            new Set(items.map(i => i.category || i.category_name).filter(Boolean))
          );
          setCategories(uniqueCats);
        }
      } catch (err) {
        console.error('Failed to fetch search catalog:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update filters when URL parameters change
  useEffect(() => {
    setSearchTerm(queryFromUrl);
    setActiveCategory(categoryFromUrl);
    setActiveCampaign(campaignFromUrl);
  }, [queryFromUrl, categoryFromUrl, campaignFromUrl]);

  // Execute filtering & sorting logic
  useEffect(() => {
    let result = [...allProducts];

    // 1. Search term filter
    if (searchTerm.trim()) {
      const term = normalize(searchTerm);
      result = result.filter(item => {
        const title = normalize(item.title || item.name);
        const desc = normalize(item.description);
        const cat = normalize(item.category || item.category_name);
        const tags = Array.isArray(item.tags) ? item.tags.map(normalize).join(' ') : normalize(item.tags);
        return title.includes(term) || desc.includes(term) || cat.includes(term) || tags.includes(term);
      });
    }

    // 2. Category filter
    if (activeCategory && activeCategory !== 'All') {
      result = result.filter(item => normalize(item.category || item.category_name) === normalize(activeCategory));
    }

    // 3. Campaign filter
    if (activeCampaign) {
      const campTerm = normalize(activeCampaign);
      result = result.filter(item => {
        const itemCamp = normalize(item.campaign || item.campaign_name || item.campaign_tag || '');
        return itemCamp.includes(campTerm) || item.is_campaign;
      });
    }

    // 4. Sorting logic
    if (sortBy === 'price_asc') {
      result.sort((a, b) => (a.price || a.sale_price || 0) - (b.price || b.sale_price || 0));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => (b.price || b.sale_price || 0) - (a.price || a.sale_price || 0));
    } else if (sortBy === 'trending') {
      result = result.filter(i => i.is_trending || i.trending);
    }

    setFilteredProducts(result);
  }, [allProducts, searchTerm, activeCategory, activeCampaign, sortBy]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;
    haptic('medium');
    addToSearchHistory(searchTerm.trim());
    setHistory(getSearchHistory());
    setSearchParams({ q: searchTerm.trim() });
  };

  const handleClearAllFilters = () => {
    haptic('light');
    setSearchTerm('');
    setActiveCategory('');
    setActiveCampaign('');
    setSearchParams({});
  };

  return (
    <div className="sp-page-container">
      {/* Sticky Top Bar */}
      <div className="sp-header">
        <button className="sp-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <form className="sp-search-form" onSubmit={handleSearchSubmit}>
          <svg className="sp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
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

      {/* Active Filter Chips Bar */}
      {(searchTerm || activeCategory || activeCampaign) && (
        <div className="sp-active-filters-bar">
          <span className="sp-filter-label">Active Filters:</span>
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
          <button className="sp-reset-all" onClick={handleClearAllFilters}>
            Clear All
          </button>
        </div>
      )}

      {/* Recent & Trending Searches (Only when search input is focused / no term active) */}
      {!searchTerm && !activeCategory && !activeCampaign && (
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

      {/* Product Results Grid */}
      <div className="sp-results-area">
        <div className="sp-results-header">
          <span className="sp-count">{filteredProducts.length} Products Found</span>
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
          <div className="sp-masonry-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="sp-skeleton-card" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="sp-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h3>No matching products found</h3>
            <p>Try searching with different keywords or clear your active campaign and category filters.</p>
            <button className="sp-reset-btn" onClick={handleClearAllFilters}>Reset Filters</button>
          </div>
        ) : (
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {filteredProducts.map((product) => (
              <MasonryCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}