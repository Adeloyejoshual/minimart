// Page/Profile/Coupons.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import '../style/Profile.css';
import { FiGift } from "react-icons/fi";

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/coupons", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCoupons(res.data);
      } catch (err) {
        console.error("Failed to fetch coupons", err);
      }
    };
    fetchCoupons();
  }, []);

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FiGift /> Coupons
      </h2>

      <div className="coupons-grid">
        {coupons.length === 0 ? (
          <p className="text-gray-500">No coupons available.</p>
        ) : (
          coupons.map((coupon) => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-header">
                <span className="coupon-code">{coupon.code}</span>
                <span className={`coupon-status ${coupon.active ? 'active' : 'inactive'}`}>
                  {coupon.active ? "Active" : "Expired"}
                </span>
              </div>
              <p className="coupon-desc">Discount: {coupon.discount}%</p>
              <p className="coupon-desc">Expires: {new Date(coupon.expiry).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Coupons;