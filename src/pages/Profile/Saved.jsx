import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiHeart, FiTrash2, FiMapPin, FiEye } from "react-icons/fi";
import api from "../services/api";
import "../../styles/Saved.css";

export default function Saved() {
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedItems = async () => {
      try {
        const res = await api.get("/favorites");
        setSavedItems(res.data.data || []);
      } catch (error) {
        console.error("Error fetching saved items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedItems();
  }, []);

  const handleRemove = async (productId) => {
    try {
      await api.delete(`/favorites/${productId}`);
      setSavedItems((prev) => prev.filter((item) => item.id !== productId));
    } catch (error) {
      console.error("Error removing saved item:", error);
    }
  };

  if (loading) {
    return (
      <div className="saved-page">
        <div className="saved-loading">Loading saved items...</div>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <div className="saved-header">
        <div className="saved-title-wrap">
          <FiHeart className="saved-title-icon" />
          <h1 className="saved-title">Saved Items</h1>
        </div>

        <span className="saved-count">{savedItems.length}</span>
      </div>

      {savedItems.length === 0 ? (
        <div className="saved-empty">
          <FiHeart className="saved-empty-icon" />
          <h2>No saved items yet</h2>
          <p>Items you save will appear here.</p>
          <Link to="/" className="saved-browse-btn">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="saved-grid">
          {savedItems.map((item) => (
            <div key={item.favorite_id} className="saved-card">
              <Link to={`/products/${item.slug}`} className="saved-image-link">
                <img
                  src={item.thumbnail_url || item.main_image || "/placeholder.png"}
                  alt={item.title}
                  className="saved-image"
                />
              </Link>

              <button
                className="saved-remove-btn"
                onClick={() => handleRemove(item.id)}
                aria-label="Remove saved item"
              >
                <FiTrash2 />
              </button>

              <div className="saved-card-body">
                <div className="saved-category">
                  {item.category_name}
                  {item.subcategory_name ? ` • ${item.subcategory_name}` : ""}
                </div>

                <Link to={`/products/${item.slug}`} className="saved-item-title">
                  {item.title}
                </Link>

                <p className="saved-description">{item.description}</p>

                <div className="saved-price">
                  ${Number(item.price || 0).toLocaleString()}
                </div>

                <div className="saved-meta">
                  <div className="saved-location">
                    <FiMapPin />
                    <span>
                      {[item.location_city, item.location_state]
                        .filter(Boolean)
                        .join(", ") || "Location not set"}
                    </span>
                  </div>

                  <div className="saved-views">
                    <FiEye />
                    <span>{item.views || 0}</span>
                  </div>
                </div>

                <div className="saved-date">
                  Saved{" "}
                  {item.saved_at
                    ? new Date(item.saved_at).toLocaleDateString()
                    : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}