import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../style/coupons.css"; // ← now uses coupons.css
import { FiGift } from "react-icons/fi";

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, []);

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FiGift /> Coupons & Rewards
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">Loading rewards...</span>
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-gray-500">No coupons or rewards available.</p>
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