import React, { useState, useEffect } from "react";
import "../../style/coupons.css";
import { FiGift } from "react-icons/fi";

// Fake coupons / rewards (what the user can win)
const fakeCoupons = [
  {
    id: 1,
    code: "WIN200",
    label: "₦200 Airtime",
    type: "airtime",
    discount: 200,
    active: true,
    expiry: "2026-12-31T23:59:59Z",
  },
  {
    id: 2,
    code: "TRYAGAIN",
    label: "Extra chance – Try again",
    type: "try_again",
    discount: 0,
    active: true,
    expiry: "2026-12-31T23:59:59Z",
  },
  {
    id: 3,
    code: "MENU100",
    label: "*100# USSD code",
    type: "ussd_code",
    discount: 0,
    active: true,
    expiry: "2026-12-31T23:59:59Z",
  },
  {
    id: 4,
    code: "WIN1GB",
    label: "1GB Data Bundle",
    type: "data",
    discount: 0,
    active: true,
    expiry: "2026-12-31T23:59:59Z",
  },
];

const Coupons = () => {
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    // FAKE SPIN: show spinner for 2 seconds, then reveal coupons
    const timer = setTimeout(() => {
      setCoupons(fakeCoupons);
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FiGift /> Coupons & Rewards
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">Spinning to win…</span>
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-gray-500">No rewards yet.</p>
      ) : (
        <div className="coupons-grid">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-header">
                <span className="coupon-code">{coupon.code}</span>
                <span className={`coupon-status ${coupon.active ? "active" : "inactive"}`}>
                  {coupon.active ? "Active" : "Expired"}
                </span>
              </div>
              <p className="coupon-desc">
                <strong>{coupon.label}</strong>
              </p>
              {coupon.type === "airtime" && (
                <p className="coupon-desc text-green-600">You won: ₦{coupon.discount}</p>
              )}
              {coupon.type === "data" && (
                <p className="coupon-desc text-blue-600">You won: {coupon.label}</p>
              )}
              {coupon.type === "try_again" && (
                <p className="coupon-desc text-orange-600">Reward: Extra chance – Try again</p>
              )}
              {coupon.type === "ussd_code" && (
                <p className="coupon-desc text-purple-600">Use code: {coupon.label}</p>
              )}
              <p className="coupon-desc text-gray-500">
                Expires: {new Date(coupon.expiry).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Coupons;