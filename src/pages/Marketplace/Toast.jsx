// components/Toast.jsx
import React, { useState, useEffect } from 'react';
import './AddProduct.css';

const Toast = ({ message, type = 'success', duration = 4000 }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{type === 'success' ? '✅' : '❌'}</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={() => setVisible(false)}>×</button>
    </div>
  );
};

export default Toast;