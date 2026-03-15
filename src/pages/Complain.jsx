// pages/Complain.jsx
import React, { useState } from "react";
import axios from "axios";
import '../style/Profile.css';

const Complain = () => {
  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    message: "",
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
      const res = await axios.post("/api/complain", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus(res.data.message || "Complaint submitted successfully!");
      setFormData({ subject: "", category: "", message: "" });
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || "Failed to submit complaint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-section p-6 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Submit a Complaint</h2>
      <p className="text-gray-600 mb-6">
        Use this form to report issues or submit complaints. Our support team will review it and get back to you.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-6">
        <div>
          <label className="block font-semibold text-gray-700 mb-2">Subject</label>
          <input
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
            placeholder="Enter subject of your complaint"
            required
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-2">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
            required
          >
            <option value="">Select category</option>
            <option value="product">Product Issue</option>
            <option value="delivery">Delivery Issue</option>
            <option value="payment">Payment Issue</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 mb-2">Message</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg resize-none h-32"
            placeholder="Write your complaint here..."
            required
          />
        </div>

        <button
          type="submit"
          className="bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white py-4 rounded-3xl font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all text-lg"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Complaint"}
        </button>

        {status && (
          <p className="mt-4 text-center font-semibold text-gray-700">{status}</p>
        )}
      </form>
    </div>
  );
};

export default Complain;