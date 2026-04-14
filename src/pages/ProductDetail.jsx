// ProductDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/product/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Product not found");
        }
        const data = await res.json();
        setProduct(data.data);
      } catch (err) {
        console.error("Fetch product detail error:", err);
        setError(err.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="loading">Loading product…</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <div className="error">{error || "Product not found"}</div>
      </div>
    );
  }

  const price = Number(product.price) || 0;
  const currency = "₦"; // change if needed
  const formattedPrice = new Intl.NumberFormat("en-NG").format(price);

  return (
    <div className="product-detail-page">
      <div className="product-container">
        {/* Left – Image gallery */}
        <div className="product-images">
          {product.images?.length > 0 ? (
            product.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`${product.title} - image ${i + 1}`}
                className="product-image"
              />
            ))
          ) : (
            <div className="placeholder-image">No image</div>
          )}
        </div>

        {/* Right – Details */}
        <div className="product-info">
          <h1>{product.title}</h1>
          <p className="product-price">
            {currency}
            {formattedPrice}
          </p>

          <p className="product-description">{product.description}</p>

          <div className="product-metadata">
            <div>
              <strong>Category:</strong> {product.category_name || "–"}
            </div>
            <div>
              <strong>Location:</strong> {product.location_city}, {product.location_state}
            </div>
            {product.promotion_id && (
              <div>
                <strong>Promoted:</strong> Yes
              </div>
            )}
          </div>

          <div className="product-contact">
            <h3>Contact Seller</h3>
            <p>
              <strong>Email:</strong> {product.contact?.email || "–"}
            </p>
            <p>
              <strong>Phone:</strong> {product.contact?.phone || "–"}
            </p>
            <p>
              <strong>WhatsApp:</strong>{" "}
              {product.contact?.whatsapp ? (
                <a
                  href={product.contact.whatsapp_link || `https://wa.me/${product.contact.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Chat on WhatsApp
                </a>
              ) : (
                "–"
              )}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .product-detail-page {
          padding: 1rem 1rem 2rem;
          max-width: 960px;
          margin: 0 auto;
        }
        .product-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .product-container {
            grid-template-columns: 1fr 1.5fr;
          }
        }
        .product-images {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .product-image,
        .placeholder-image {
          width: 100%;
          max-width: 500px;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #ddd;
        }
        .placeholder-image {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
        }
        .product-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .product-price {
          font-size: 1.5rem;
          font-weight: bold;
          color: #111;
        }
        .product-description {
          line-height: 1.5;
          font-size: 0.95rem;
        }
        .product-metadata,
        .product-contact {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.9rem;
        }
        a {
          color: #0066cc;
        }
        .loading,
        .error {
          padding: 2rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}