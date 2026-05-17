// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  FiUser,
  FiUsers,
  FiStar,
  FiGift,
  FiCreditCard,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiHeadphones,
  FiPlus,
  FiLock,
  FiUnlock,
} from "react-icons/fi";

import ProHeader from "../components/ProHeader";
import BottomNav from "../components/BottomNav";
import "../style/Profile.css";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return navigate("/auth");
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
    } catch (err) {
      localStorage.removeItem("token");
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  const subscription = user?.subscription || { plan: "free" };
  const permissions = user?.permissions || {};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      <ProHeader title="Profile" showBack />

      {/* ================= PROFILE HEADER ================= */}
      <div className="mx-4 mt-6 bg-white rounded-3xl shadow-sm p-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">

            <div className="w-16 h-16 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center overflow-hidden">
              {user?.profile_image ? (
                <img
                  src={user.profile_image}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FiUser className="w-8 h-8 text-indigo-600" />
              )}
            </div>

            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {user?.name || "User"}
              </h1>
              <p className="text-sm text-gray-500">
                {user?.store_name || "Marketplace Account"}
              </p>
              <p className="text-xs text-indigo-600">{user?.email}</p>
            </div>

          </div>

          <button
            onClick={logout}
            className="text-sm text-red-500 font-medium"
          >
            Logout
          </button>
        </div>

        {/* ================= SUBSCRIPTION ================= */}
        <div className="mt-5 flex items-center justify-between bg-gray-50 p-4 rounded-2xl">

          <div>
            <p className="text-sm font-semibold text-gray-900 uppercase">
              {subscription.plan || "FREE"} PLAN
            </p>

            <p className="text-xs text-gray-500">
              {subscription.expires_at
                ? `Expires: ${new Date(subscription.expires_at).toDateString()}`
                : "No active subscription"}
            </p>
          </div>

          <button className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-xl hover:bg-indigo-700">
            Upgrade
          </button>

        </div>

        {/* ================= METRICS ================= */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Metric label="Orders" value="0" />
          <Metric label="Wallet" value="₦0" />
          <Metric label="Rating" value="0.0" />
        </div>

      </div>

      {/* ================= ACCOUNT ================= */}
      <Section title="Account">
        <Grid>

          <Card
            icon={<FiUsers />}
            label="Dashboard"
            to="/dashboard"
            locked={false}
          />

          <Card
            icon={<FiCreditCard />}
            label="Wallet"
            to="/wallet"
            locked={!permissions.can_withdraw}
          />

          <Card
            icon={<FiCheckCircle />}
            label="Verification"
            to="/verification"
            locked={!permissions.can_verify}
          />

          <Card
            icon={<FiUser />}
            label="Become Seller"
            to="/become-seller"
            locked={false}
          />

        </Grid>
      </Section>

      {/* ================= BUSINESS ================= */}
      <Section title="Business Tools">
        <Grid>

          <Card
            icon={<FiPlus />}
            label="Add Product"
            to="/minimart/add"
            locked={!permissions.can_sell}
          />

          <Card
            icon={<FiStar />}
            label="Leaderboard"
            to="/leaderboard"
            locked={false}
          />

          <Card
            icon={<FiGift />}
            label="Coupons"
            to="/coupons"
            locked={false}
          />

          <Card
            icon={<FiGift />}
            label="Invitation"
            to="/invitation"
            locked={false}
          />

        </Grid>
      </Section>

      {/* ================= SUPPORT ================= */}
      <Section title="Support">
        <Grid>

          <Card icon={<FiMessageSquare />} label="Complain" to="/complain" />
          <Card icon={<FiFileText />} label="FAQ" to="/faq" />
          <Card icon={<FiHeadphones />} label="Support" to="/support" />

        </Grid>
      </Section>

      <BottomNav />
    </div>
  );
};

/* ================= COMPONENTS ================= */

const Metric = ({ label, value }) => (
  <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
    <p className="text-sm font-semibold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mx-4 mt-6">
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {title}
    </h2>
    {children}
  </div>
);

const Grid = ({ children }) => (
  <div className="grid grid-cols-2 gap-3">{children}</div>
);

const Card = ({ icon, label, to, locked }) => (
  <Link
    to={locked ? "#" : to}
    className={`rounded-2xl p-4 flex flex-col gap-2 border transition
      ${locked
        ? "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
        : "bg-white border-gray-100 hover:shadow-sm active:scale-[0.98]"
      }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-indigo-600 text-lg">{icon}</span>
      {locked ? (
        <FiLock className="text-gray-400" />
      ) : (
        <FiUnlock className="text-green-500" />
      )}
    </div>

    <span className="text-sm font-medium text-gray-700">{label}</span>

    {locked && (
      <span className="text-[10px] text-gray-400">
        Upgrade required
      </span>
    )}
  </Link>
);

export default Profile;