// PromotionPlans.jsx - YOUR NIGERIAN MARKETPLACE PROMOTIONS
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt, FaCrown, FaChartLine } from "react-icons/fa";
import { promotionPlans, getDiscountPercent, getActivePrice } from '../config/promotion.js';
import { useState } from 'react';

const PromotionPlans = () => {
  const [loading, setLoading] = useState({});
  const [message, setMessage] = useState('');

  const subscribePlan = async (plan) => {
    setLoading(prev => ({ ...prev, [plan.id]: true }));
    setMessage('');

    try {
      const response = await fetch('/api/marketplace/subscribe-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          amount: getActivePrice(plan.price, plan.discount) * 100, // kobo
          email: 'seller@minimart.com', // from auth
          metadata: { plan_name: plan.name, duration: plan.duration }
        })
      });

      const data = await response.json();
      
      if (data.status) {
        // Redirect to Paystack
        window.open(data.data.authorization_url, '_blank');
        setMessage(`✅ Redirecting to Paystack for ${plan.name}...`);
      } else {
        setMessage(`❌ Payment failed: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [plan.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-6">
            Boost Your Sales
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Get featured on homepage, top listings, WhatsApp blasts & more. 
            Start selling 10x faster today!
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {promotionPlans.map((plan) => {
            const activePrice = getActivePrice(plan.price, plan.discount);
            const discountPercent = getDiscountPercent(plan.price, plan.discount);
            
            return (
              <div 
                key={plan.id}
                className={`group relative overflow-hidden rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border-4 ${
                  plan.discount > 0 
                    ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50' 
                    : plan.price === 0 
                    ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' 
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                {/* Badge */}
                {discountPercent > 0 && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                    {discountPercent}% OFF
                  </div>
                )}
                
                {plan.price === 0 && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                    FREE TRIAL
                  </div>
                )}

                {/* Icon */}
                <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <plan.icon className="w-10 h-10 text-purple-600 group-hover:text-purple-700" />
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-black text-gray-900 mb-4 text-center">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="text-center mb-6">
                  <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
                    ₦{activePrice.toLocaleString()}
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                      <span className="line-through">₦{plan.originalPrice.toLocaleString()}</span>
                      <span className="text-green-600 font-bold">Save ₦{plan.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mt-1">{plan.duration}</div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-center mb-8 leading-relaxed">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        </svg>
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => subscribePlan(plan)}
                  disabled={loading[plan.id]}
                  className={`w-full py-4 px-6 rounded-2xl font-bold text-lg shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 ${
                    plan.price === 0
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                  }`}
                >
                  {loading[plan.id] ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PromotionPlans;