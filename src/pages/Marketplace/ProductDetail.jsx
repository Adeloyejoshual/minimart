// src/pages/Marketplace/ProductDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMarketplaceProductById } from "../../helpers/marketplace";
import { useAuth0 } from "@auth0/auth0-react";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const data = await getMarketplaceProductById(id);
      setProduct(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!product) {
    return <p style={{ padding: "16px" }}>Loading product...</p>;
  }

  const handleChat = () => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }
    // Navigate to marketplace chat page with seller ID
    navigate(`/marketplace/chat/${product.sellerId}`);
  };

  return (
    <div className="marketplace-detail-page">
      {/* Sticky Header */}
      <div className="sticky-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ←
        </button>
        <h2 className="header-title">{product.title}</h2>
        <button className="chat-btn" onClick={handleChat}>
          Chat with Seller
        </button>
      </div>

      {/* Product Image */}
      {product.image_url && (
        <div className="product-image-wrapper">
          <img src={product.image_url} alt={product.title} />
        </div>
      )}

      {/* Product Info */}
      <div className="product-info">
        <h3 className="product-title">{product.title}</h3>
        <p className="product-price">₦{product.price}</p>
        {product.description && (
          <p className="product-description">{product.description}</p>
        )}
      </div>

      {/* Inline Styles */}
      <style>{`
        .marketplace-detail-page {
          padding: 16px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #fff7e6;
          color: #222;
        }

        .sticky-header {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #fd7e14;
          color: #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.15);
          z-index: 100;
        }

        .header-title {
          flex: 1;
          text-align: center;
          font-weight: 600;
          font-size: 16px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .back-btn,
        .chat-btn {
          background: #fd7e14;
          color: #fff;
          border: none;
          padding: 8px 12px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-btn:hover,
        .chat-btn:hover {
          background: #e06c00;
        }

        .product-image-wrapper {
          margin: 16px 0;
          text-align: center;
        }

        .product-image-wrapper img {
          width: 100%;
          max-width: 400px;
          height: auto;
          border-radius: 16px;
          object-fit: cover;
        }

        .product-info {
          background: #fff3db;
          padding: 16px;
          border-radius: 16px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
        }

        .product-title {
          font-size: 20px;
          font-weight: 600;
          color: #fd7e14;
          margin-bottom: 8px;
        }

        .product-price {
          font-size: 22px;
          font-weight: bold;
          color: #dc3545;
          margin-bottom: 12px;
        }

        .product-description {
          font-size: 14px;
          margin-bottom: 16px;
          color: #444;
        }

        @media (min-width: 600px) {
          .product-title {
            font-size: 22px;
          }
          .product-price {
            font-size: 24px;
          }
        }

        @media (min-width: 900px) {
          .product-image-wrapper img {
            max-width: 600px;
          }
          .product-title {
            font-size: 24px;
          }
          .product-price {
            font-size: 26px;
          }
        }
      `}</style>
    </div>
  );
}