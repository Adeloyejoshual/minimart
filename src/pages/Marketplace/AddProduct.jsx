// src/pages/Marketplace/AddProduct.jsx - DEBUG VERSION
import React, { useState, useEffect } from 'react';

const AddProduct = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('API error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>🔄 Loading...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🛒 Nigerian Marketplace</h1>
      <p>Status: {products.length} products loaded</p>
      
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {products.map(product => (
          <div key={product._id} style={{ 
            border: '1px solid #ddd', 
            padding: '1rem', 
            borderRadius: '8px' 
          }}>
            <h3>{product.title}</h3>
            <p>₦{Number(product.price).toLocaleString()}</p>
            <small>{product.state} • {product.category}</small>
          </div>
        ))}
      </div>
      
      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
          <h2>🎉 No products yet!</h2>
          <p>Be the first to add a listing</p>
          <button style={{ 
            background: '#10b981', 
            color: 'white', 
            padding: '1rem 2rem', 
            border: 'none', 
            borderRadius: '8px', 
            fontSize: '1.1rem' 
          }}>
            ➕ Add First Product
          </button>
        </div>
      )}
    </div>
  );
};

export default AddProduct;