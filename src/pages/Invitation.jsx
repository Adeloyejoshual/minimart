// pages/Invitation.jsx
import React, { useState } from "react";
import { FiCopy, FiMail, FiShare2 } from "react-icons/fi";
import '../style/Profile.css';

const Invitation = () => {
  const [referralLink] = useState("https://minimart.ng/invite?code=ABC123");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dashboard-section p-6 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Invite Friends</h2>
      <p className="text-gray-600 mb-6">
        Invite your friends to Minimart and earn rewards when they join!
      </p>

      <div className="invite-card p-6 bg-white rounded-2xl shadow-xl mb-6">
        <p className="font-semibold text-gray-700 mb-2">Your Referral Link</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 p-4 border-2 border-gray-200 rounded-2xl text-gray-800 text-lg"
          />
          <button
            onClick={handleCopy}
            className="bg-indigo-500 text-white p-4 rounded-2xl hover:bg-indigo-600 transition-all flex items-center gap-2"
          >
            <FiCopy /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="invite-actions flex flex-col md:flex-row gap-4">
        <button className="flex items-center gap-2 justify-center bg-green-500 text-white p-4 rounded-2xl hover:bg-green-600 transition-all">
          <FiMail /> Invite via Email
        </button>
        <button className="flex items-center gap-2 justify-center bg-purple-500 text-white p-4 rounded-2xl hover:bg-purple-600 transition-all">
          <FiShare2 /> Share on Social Media
        </button>
      </div>
    </div>
  );
};

export default Invitation;