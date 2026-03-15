// pages/FAQ.jsx
import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import '../style/Profile.css';

const faqData = [
  {
    question: "How do I become a verified seller?",
    answer: "Go to the 'Become a Seller' page and submit your store details and bank info. Our team will review your request."
  },
  {
    question: "How do I withdraw funds from my wallet?",
    answer: "Navigate to the Wallet tab, then click 'Withdraw'. You can select your preferred withdrawal method and amount."
  },
  {
    question: "How can I invite friends to Minimart?",
    answer: "Use the 'Invitation' page to copy your referral link or share via email/social media to earn rewards."
  },
  {
    question: "How are orders and messages managed?",
    answer: "Check your Dashboard tab to see orders, products, and messages from buyers."
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleIndex = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="dashboard-section p-6 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>

      <div className="faq-container">
        {faqData.map((item, index) => (
          <div key={index} className="faq-card">
            <div
              className="faq-question flex justify-between items-center cursor-pointer p-4"
              onClick={() => toggleIndex(index)}
            >
              <span className="font-semibold text-gray-800">{item.question}</span>
              {openIndex === index ? <FiChevronUp /> : <FiChevronDown />}
            </div>
            {openIndex === index && (
              <div className="faq-answer p-4 text-gray-600 border-t border-gray-200">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;