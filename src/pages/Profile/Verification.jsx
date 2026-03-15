// Page/Profile/Verification.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import '../style/Profile.css';
import { FiCheckCircle, FiAlertCircle, FiUpload } from "react-icons/fi";

const Verification = () => {
  const [verification, setVerification] = useState({
    status: "Not Verified",
    message: "You have not submitted your verification documents yet.",
  });

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/verification/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVerification(res.data);
      } catch (err) {
        console.error("Failed to fetch verification status", err);
      }
    };
    fetchVerification();
  }, []);

  const statusIcon = () => {
    switch (verification.status) {
      case "Verified":
        return <FiCheckCircle className="verification-icon verified" />;
      case "Pending":
        return <FiAlertCircle className="verification-icon pending" />;
      case "Rejected":
        return <FiAlertCircle className="verification-icon rejected" />;
      default:
        return <FiUpload className="verification-icon default" />;
    }
  };

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-6">Seller Verification</h2>
      <div className="verification-card">
        <div className="flex items-center gap-4 mb-4">
          {statusIcon()}
          <span className={`verification-status ${verification.status.toLowerCase()}`}>
            {verification.status}
          </span>
        </div>
        <p className="verification-message mb-6">{verification.message}</p>
        {(verification.status === "Not Verified" || verification.status === "Rejected") && (
          <button className="verification-btn">
            <FiUpload className="mr-2" /> Submit Verification Documents
          </button>
        )}
      </div>
    </div>
  );
};

export default Verification;