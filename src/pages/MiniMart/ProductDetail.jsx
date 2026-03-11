import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMiniMartProductById } from "../../helpers/minimart";
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
      const data = await getMiniMartProductById(id);
      setProduct(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!product) {
    return <p>Loading product...</p>;
  }

  return (
    <div className="product-detail-page">
      <div className="sticky-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ←
        </button>
        <h2 className="header-title">{product.title}</h2>
        {isAuthenticated ? (
          <button className="chat-btn" onClick={() => console.log("Message seller")}>
            Message
          </button>
        ) : (
          <button className="chat-btn" onClick={() => loginWithRedirect()}>
            Login
          </button>
        )}
      </div>

      {product.image && (
        <div className="product-image-wrapper">
          <img src={product.image} alt={product.title} />
        </div>
      )}

      <div className="product-info">
        <h3 className="product-title">{product.title}</h3>
        <p className="product-price">₦{product.price}</p>
        {product.description && <p className="product-description">{product.description}</p>}

        {isAuthenticated && (
          <div className="product-actions">
            <button className="chat-btn">Contact Seller</button>
            <button className="quick-msg-btn">Add to Cart</button>
          </div>
        )}
      </div>

      <style>{`
        .product-detail-page {
          padding: 16px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #eaf2ff;
          color: #222;
        }
        .sticky-header {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: #0D6EFD;
          color: #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.15);
          z-index: 100;
        }
        .header-title { flex: 1; text-align: center; font-weight: 600; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .back-btn, .chat-btn { background: #0D6EFD; color: #fff; border: none; padding: 8px 12px; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .back-btn:hover, .chat-btn:hover { background: #0b5ed7; }
        .product-image-wrapper { margin: 16px 0; text-align: center; }
        .product-image-wrapper img { width: 100%; max-width: 400px; height: auto; border-radius: 16px; object-fit: cover; }
        .product-info { background: #fff; padding: 16px; border-radius: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .product-title { font-size: 20px; font-weight: 600; color: #0D6EFD; margin-bottom: 8px; }
        .product-price { font-size: 22px; font-weight: bold; color: #198754; margin-bottom: 12px; }
        .product-description { font-size: 14px; margin-bottom: 16px; color: #444; }
        .product-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .quick-msg-btn { background: #198754; color: #fff; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; }
        .quick-msg-btn:hover { background: #157347; }
        @media (min-width: 600px) { .product-title { font-size: 22px; } .product-price { font-size: 24px; } }
        @media (min-width: 900px) { .product-image-wrapper img { max-width: 600px; } .product-title { font-size: 24px; } .product-price { font-size: 26px; } }
      `}</style>
    </div>
  );
}
