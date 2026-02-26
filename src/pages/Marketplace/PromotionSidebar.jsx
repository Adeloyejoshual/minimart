// components/PromotionSidebar.jsx
import React, { useState } from 'react';
import { loadScript } from '@paystack/inline-js';

const PromotionSidebar = ({ promotionPlans }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handlePaystackPayment = () => {
    const paystack = loadScript('pk_test_your_public_key');
    
    const handler = paystack({
      key: 'pk_test_your_public_key',
      email: 'user@example.com',
      amount: selectedPlan.price * 100, // kobo
      ref: `promo_${Date.now()}`,
      onClose: () => alert('Payment cancelled'),
      callback: (response) => {
        console.log('Payment successful:', response.reference);
        // Verify payment server-side
      }
    });
    
    handler.openIframe();
  };

  return (
    <div className="sidebar">
      <div className="promotion-panel">
        <h3>Boost Your Listing</h3>
        {promotionPlans.map(plan => (
          <div key={plan.id} className="promotion-card">
            <span className="promotion-icon">{plan.icon}</span>
            <div>
              <div className="promotion-name">{plan.name}</div>
              <div className="promotion-price">
                ₦{plan.price.toLocaleString()}
                <button 
                  onClick={() => {
                    setSelectedPlan(plan);
                    handlePaystackPayment();
                  }}
                  className="paystack-btn"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromotionSidebar;