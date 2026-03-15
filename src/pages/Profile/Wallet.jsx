// Page/Profile/Wallet.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import '../style/Profile.css';
import { FiCreditCard, FiPlus, FiArrowUp } from "react-icons/fi";

const Wallet = () => {
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWallet(res.data);
      } catch (err) {
        console.error("Failed to fetch wallet", err);
      }
    };

    fetchWallet();
  }, []);

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <FiCreditCard /> Wallet
      </h2>

      {/* Wallet Balance Card */}
      <div className="wallet-balance-card mb-6">
        <p className="text-gray-500">Current Balance</p>
        <p className="text-3xl font-bold text-gray-900">{wallet.balance} NGN</p>
        <div className="wallet-actions mt-4 flex gap-4">
          <button className="wallet-btn add-funds">
            <FiPlus className="mr-2" /> Add Funds
          </button>
          <button className="wallet-btn withdraw">
            <FiArrowUp className="mr-2" /> Withdraw
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="wallet-transactions">
        <h3 className="text-xl font-semibold mb-3">Recent Transactions</h3>
        {wallet.transactions.length === 0 ? (
          <p className="text-gray-500">No transactions yet.</p>
        ) : (
          wallet.transactions.map((tx) => (
            <div key={tx.id} className="transaction-card">
              <div className="transaction-left">
                <p className="transaction-type">{tx.type}</p>
                <p className="transaction-date">{new Date(tx.date).toLocaleDateString()}</p>
              </div>
              <p className={`transaction-amount ${tx.type === "Deposit" ? "credit" : "debit"}`}>
                {tx.type === "Deposit" ? "+" : "-"} {tx.amount} NGN
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Wallet;