// src/pages/Marketplace/MarketplaceProductDetail.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function MarketplaceProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(true);

  /* =========================
     FETCH PRODUCT
  ========================== */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/marketplace/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load product");
        }

        setProduct(data);
        setSelectedImage(data.images?.[0] || "");
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ textAlign: "center", marginTop: 50 }}>
        Product not found
      </div>
    );
  }

  /* =========================
     UI
  ========================== */

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 20px" }}>
      
      {/* HEADER */}
      <h1 style={{ marginBottom: 10 }}>
        {product.title}
      </h1>

      {product.promoted && (
        <span
          style={{
            background: "#ffcc00",
            padding: "5px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: "bold"
          }}
        >
          ⭐ Sponsored
        </span>
      )}

      {/* MAIN SECTION */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 40,
          marginTop: 30
        }}
      >
        
        {/* IMAGE SECTION */}
        <div style={{ flex: 1, minWidth: 300 }}>
          
          {/* Main Image */}
          <div
            style={{
              width: "100%",
              height: 400,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 15,
              border: "1px solid #ddd"
            }}
          >
            <img
              src={selectedImage}
              alt="Product"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          </div>

          {/* Thumbnails */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {product.images?.map((img, index) => (
              <img
                key={index}
                src={img}
                alt="Thumbnail"
                onClick={() => setSelectedImage(img)}
                style={{
                  width: 70,
                  height: 70,
                  objectFit: "cover",
                  borderRadius: 6,
                  cursor: "pointer",
                  border:
                    selectedImage === img
                      ? "2px solid #007BFF"
                      : "1px solid #ddd"
                }}
              />
            ))}
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div style={{ flex: 1, minWidth: 300 }}>
          
          <h2 style={{ marginBottom: 10 }}>
            ₦{Number(product.price).toLocaleString()}
          </h2>

          {product.discount_price && (
            <p
              style={{
                textDecoration: "line-through",
                color: "gray",
                marginBottom: 10
              }}
            >
              ₦{Number(product.discount_price).toLocaleString()}
            </p>
          )}

          <p style={{ marginBottom: 20 }}>
            {product.description}
          </p>

          {/* BASIC INFO */}
          <div style={{ marginBottom: 20 }}>
            <h3>Product Information</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              <li><strong>Category:</strong> {product.category}</li>
              {product.brand && <li><strong>Brand:</strong> {product.brand}</li>}
              {product.model && <li><strong>Model:</strong> {product.model}</li>}
              {product.condition && <li><strong>Condition:</strong> {product.condition}</li>}
              {product.year && <li><strong>Year:</strong> {product.year}</li>}
              {product.color && <li><strong>Color:</strong> {product.color}</li>}
              {product.ram && <li><strong>RAM:</strong> {product.ram}</li>}
              {product.storage && <li><strong>Storage:</strong> {product.storage}</li>}
            </ul>
          </div>

          {/* DELIVERY */}
          {product.deliveryRegions?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3>Delivery Information</h3>
              {product.deliveryRegions.map((d, index) => (
                <p key={index}>
                  {d.state} - {d.city} | {d.method} | {d.from}-{d.to} days{" "}
                  {d.chargeFee
                    ? `| ₦${Number(d.fee).toLocaleString()}`
                    : "| Free Delivery"}
                </p>
              ))}
            </div>
          )}

          {/* CONTACT SECTION */}
          <div
            style={{
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 10
            }}
          >
            <h3>Seller Information</h3>
            <p><strong>Name:</strong> {product.poster_name}</p>
            <p><strong>Location:</strong> {product.state}, {product.city}</p>

            <a
              href={`tel:${product.phone_number}`}
              style={{
                display: "block",
                marginTop: 10,
                padding: 12,
                background: "#007BFF",
                color: "#fff",
                textAlign: "center",
                borderRadius: 8,
                textDecoration: "none"
              }}
            >
              Call Seller
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}