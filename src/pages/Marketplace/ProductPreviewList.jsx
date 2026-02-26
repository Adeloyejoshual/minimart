// components/ProductPreviewList.jsx
import React from 'react';

const ProductPreviewList = ({ products }) => (
  products.length > 0 && (
    <div className="products-preview">
      <h2>Recently Added ({products.length})</h2>
      <div className="products-grid">
        {products.map(product => (
          <div key={product._id} className="product-card">
            <img src={product.images?.[0]} alt={product.title} />
            <h3>{product.title}</h3>
            <div className="price">
              {product.discount_price ? (
                <>
                  <span className="original-price">₦{Number(product.price).toLocaleString()}</span>
                  <span className="discount-price">₦{Number(product.discount_price).toLocaleString()}</span>
                </>
              ) : (
                <span>₦{Number(product.price).toLocaleString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
);

export default ProductPreviewList;