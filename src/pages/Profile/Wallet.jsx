// Page/Profile/Wallet.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../style/Profile.css";
import {
  FiCreditCard,
  FiPlus,
  FiArrowUp,
  FiClock,
} from "react-icons/fi";

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const token = localStorage.getItem("token");

        const walletRes = await axios.get("/api/wallet/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const txRes = await axios.get("/api/wallet/me/transactions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setWallet(walletRes.data.data);
        setTransactions(txRes.data.transactions || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load wallet.");
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, []);

  if (loading) {
    return (
      <div className="wallet-container">
        <p className="wallet-muted">Loading wallet...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-container">
        <p className="wallet-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <h2 className="wallet-title">
        <FiCreditCard /> Wallet Overview
      </h2>

      {/* Balance Cards */}
      <div className="wallet-grid">
        <div className="wallet-card primary">
          <p className="wallet-label">Available Balance</p>
          <h3>₦ {wallet.available_balance?.toLocaleString()}</h3>
        </div>

        <div className="wallet-card pending">
          <p className="wallet-label">
            <FiClock /> Pending Balance
          </p>
          <h3>₦ {wallet.pending_balance?.toLocaleString()}</h3>
        </div>

        <div className="wallet-card earned">
          <p className="wallet-label">Total Earned</p>
          <h3>₦ {wallet.total_earned?.toLocaleString()}</h3>
        </div>
      </div>

      {/* Actions */}
      <div className="wallet-actions">
        <button className="wallet-btn add">
          <FiPlus /> Add Funds
        </button>

        <button className="wallet-btn withdraw">
          <FiArrowUp /> Withdraw
        </button>
      </div>

      {/* Transactions */}
      <div className="wallet-transactions">
        <h3>Recent Transactions</h3>

        {transactions.length === 0 ? (
          <p className="wallet-muted">No transactions yet.</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="transaction-item">
              <div>
                <p className="tx-type">{tx.type}</p>
                <p className="tx-date">
                  {new Date(tx.created_at).toLocaleDateString()}
                </p>
              </div>

              <div
                className={`tx-amount ${
                  tx.type === "credit" || tx.type === "release"
                    ? "credit"
                    : "debit"
                }`}
              >
                {tx.type === "credit" || tx.type === "release" ? "+" : "-"} ₦
                {Number(tx.amount).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Wallet;