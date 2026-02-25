// components/LoadingSpinner.jsx
import React from 'react';
import './AddProduct.css';

const LoadingSpinner = ({ message = "Loading Add Product..." }) => (
  <div className="professional-loader">
    <div className="loader-container">
      <div className="loader-ring">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <div className="loader-glow"></div>
      <div className="loader-text">
        <div className="loader-title">{message}</div>
        <div className="loader-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  </div>
);

export default LoadingSpinner;