import React, { useState } from "react";
import "../../style/coupons.css";
import { FiGift } from "react-icons/fi";

const rewards = [
  { id: 1, label: "₦200 Airtime", color: "#e53e3e" }, // Red
  { id: 2, label: "1GB Data Bundle", color: "#805ad5" }, // Purple
  { id: 3, label: "USSD code: *100#", color: "#744210" }, // Brown
  { id: 4, label: "Extra chance", color: "#f687b3" }, // Pink
  { id: 5, label: "₦200 Airtime", color: "#718096" }, // Gray
  { id: 6, label: "1GB Data Bundle", color: "#3182ce" }, // Blue
  { id: 7, label: "USSD code: *100#", color: "#ed8936" }, // Orange
  { id: 8, label: "Extra chance", color: "#38a169" }, // Green
];

const Coupons = () => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  const handleSpin = () => {
    if (spinning) return;

    const newRotation = rotation + 1800 + Math.floor(Math.random() * 360);
    setRotation(newRotation);
    setSpinning(true);
    setResult(null);

    setTimeout(() => {
      // Calculate which segment it landed on (8 segments = 45 degrees each)
      const actualDegree = newRotation % 360;
      const segmentIndex = 7 - Math.floor(actualDegree / 45); 
      setResult(rewards[segmentIndex]);
      setSpinning(false);
    }, 3000); // 3-second spin for better effect
  };

  return (
    <div className="dashboard-section p-6 text-center">
      <h2 className="text-2xl font-bold mb-8 flex justify-center items-center gap-2">
        <FiGift /> Lucky Win Spin
      </h2>

      {/* The Visual Wheel */}
      <div className="relative mx-auto mb-10 w-64 h-64">
        {/* Needle/Pointer */}
        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-white drop-shadow-md"></div>
        
        <div 
          className="w-full h-full rounded-full border-4 border-white shadow-xl overflow-hidden transition-transform duration-[3000ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)`, background: `conic-gradient(${rewards.map((r, i) => `${r.color} ${i * 45}deg ${(i + 1) * 45}deg`).join(", ")})` }}
        >
          {rewards.map((r, i) => (
            <span key={i} className="absolute inset-0 text-white font-bold" style={{ transform: `rotate(${i * 45 + 22.5}deg)`, textAlign: 'center', paddingTop: '20px' }}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning}
        className={`px-10 py-3 font-bold text-white rounded-full shadow-lg ${
          spinning ? "bg-gray-400" : "bg-blue-600 hover:scale-105 active:scale-95 transition-all"
        }`}
      >
        {spinning ? "Good Luck..." : "SPIN TO WIN"}
      </button>

      {result && !spinning && (
        <div className="mt-8 p-4 bg-green-50 border-2 border-green-200 rounded-xl animate-bounce">
          <h3 className="font-bold text-green-800">🎉 Winner!</h3>
          <p className="text-xl font-black text-green-900">{result.label}</p>
        </div>
      )}
    </div>
  );
};

export default Coupons;
