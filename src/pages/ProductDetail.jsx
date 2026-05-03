// ProductDetail.js
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

// You can replace this with your actual Axios / fetch layer
const API_BASE = "/api/product";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError(false);

      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add auth if needed:
            // Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Product not found");

        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("[ProductDetail] Fetch error:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadProduct();
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="container my-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading product…</span>
        </div>
        <p className="mt-2">Loading product details</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container my-5">
        <div className="alert alert-danger">
          Product not found or failed to load.
        </div>
      </div>
    );
  }

  const isPromoted =
    product.is_active === true &&
    product.status === "active" &&
    product.promotion_priority > 0;

  return (
    <div className="container my-5">
      <div className="row">
        {/* Images */}
        <div className="col-lg-6">
          <div className="position-relative mb-3">
            {isPromoted && (
              <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2">
                Promoted
              </span>
            )}
            <img
              src={product.main_image || product.thumbnail_url}
              alt={product.title}
              className="img-fluid rounded"
              style={{ maxHeight: "60vh", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Product info */}
        <div className="col-lg-6">
          <h1 className="h3">{product.title}</h1>
          <p className="text-muted">{product.description}</p>

          <div className="d-flex align-items-center mb-3">
            <h4 className="mb-0">
              ₦{Number(product.price || 0).toLocaleString()}
            </h4>
            {isPromoted && (
              <span className="badge bg-primary ms-2">Featured</span>
            )}
          </div>

          {/* Attributes (brand, model, etc.) */}
          {product.attributes &&
            Object.keys(product.attributes).length > 0 && (
              <div className="mb-3">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <span
                    key={key}
                    className="badge bg-light text-dark me-2"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            )}

          <div className="mb-3">
            <strong>Views:</strong> {product.views?.toLocaleString() || 0}
            <br />
            <strong>Favorites:</strong>{" "}
            {product.favorites_count?.toLocaleString() || 0}
          </div>

          {/* Specifications */}
          {product.specifications &&
            Object.keys(product.specifications).length > 0 && (
              <div className="mb-3">
                <h6>Specifications</h6>
                <ul className="list-unstyled">
                  {Object.entries(product.specifications).map(
                    ([key, value]) => (
                      <li key={key}>
                        <small>
                          <strong>{key}:</strong> {value}
                        </small>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

          {/* Highlights */}
          {Array.isArray(product.highlights) &&
            product.highlights.length > 0 && (
              <div className="mb-3">
                <h6>Highlights</h6>
                <ul className="list-unstyled">
                  {product.highlights.map((hl, idx) => (
                    <li key={idx}>
                      <small>• {hl}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* FAQ */}
          {Array.isArray(product.faq) && product.faq.length > 0 && (
            <div className="mb-4">
              <h6>FAQ</h6>
              {product.faq.map((item, idx) => (
                <details key={idx} className="mb-2">
                  <summary className="fw-semibold">
                    {item.question}
                  </summary>
                  <p className="small text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          )}

          {/* Contact / CTA */}
          <div className="border-top pt-3 mt-3">
            <h6>Contact Seller</h6>
            <div className="d-flex gap-2 flex-wrap">
              {product.whatsapp_link && product.whatsapp && (
                <a
                  href={product.whatsapp_link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-success btn-sm"
                >
                  WhatsApp
                </a>
              )}
              {product.phone && (
                <a
                  href={`tel:${product.phone}`}
                  className="btn btn-outline-dark btn-sm"
                >
                  Call
                </a>
              )}
              <button className="btn btn-outline-primary btn-sm">
                Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;