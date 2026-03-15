// pages/BecomeSeller.jsx
import React, { useState } from "react";
import axios from "axios";
import '../style/Profile.css'; // Reuse existing styles

const BecomeSeller = () => {
  const [formData, setFormData] = useState({
    store_name: "",
    bank_account: "",
    withdrawal_method: "",
  });

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post("/api/seller/become", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data.message || "Seller request submitted successfully!");
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-section p-6 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Become a Seller</h2>

      <p className="text-gray-600 mb-6">
        Join our marketplace and start selling your products to millions of users. Fill in your store details below.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <div>
          <label className="block font-semibold text-gray-700 mb-2">Store Name</label>
          <input
            name="store_name"
            value={formData.store_name}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
            placeholder="Enter your store name"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-2">Bank Account</label>
          <input
            name="bank_account"
            value={formData.bank_account}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
            placeholder="Enter your bank account number"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-2">Withdrawal Method</label>
          <select
            name="withdrawal_method"
            value={formData.withdrawal_method}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
            required
          >
            <option value="">Select Method</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="paypal">PayPal</option>
            <option value="crypto">Crypto Wallet</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white py-4 rounded-3xl font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all text-lg"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Seller Request"}
        </button>

        {status && (
          <p className="mt-4 text-center font-semibold text-gray-700">{status}</p>
        )}
      </form>
    </div>
  );
};

export default BecomeSeller;