import React, { useState } from "react";
import "../../style/coupons.css";
import { FiGift } from "react-icons/fi";

// Rewards user can win
const rewards = [
  { id: 1, label: "₦200 Airtime", type: "airtime", value: 200 },
  { id: 2, label: "Extra chance – Try again", type: "try_again" },
  { id: 3, label: "USSD code: *100#", type: "ussd_code" },
  { id: 4, label: "1GB Data Bundle", type: "data" },
];

const Coupons = () => {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const handleSpin = () => {
    if (spinning) return;

    setSpinning(true);
    setResult(null);
    setShowResult(false);

    // Fake spin delay
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * rewards.length);
      const selected = rewards[randomIndex];
      setResult(selected);
      setSpinning(false);
      setShowResult(true);
    }, 2000); // 2‑second spin
  };

  return (
    <div className="dashboard-section p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FiGift /> Lucky Win Spin
      </h2>

      {/* Spin wheel / button */}
      <div className="flex justify-center my-6">
        <button
          onClick={handleSpin}
          disabled={spinning}
          className={`px-8 py-3 font-bold text-white rounded-full transition-all ${
            spinning ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {spinning ? "Spinning…" : "Spin to win"}
        </button>
      </div>

      {/* Fake spinner during spin */}
      {spinning && (
        <div className="flex justify-center my-4">
          <div className="w-10 h-10 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      )}

      {/* Show result after spin */}
      {showResult && result && (
        <div className="text-center mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-bold text-blue-800">You won:</h3>
          <p className="text-xl font-semibold text-blue-900">{result.label}</p>
        </div>
      )}

      {/* Optional: list of possible rewards */}
      <div className="mt-8">
        <h3 className="text-sm text-gray-500 mb-2">Possible rewards:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          {rewards.map((r) => (
            <li key={r.id}>- {r.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Coupons;