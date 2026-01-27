// src/config/settingsPages.js
import { FaArrowRight } from "react-icons/fa";

export const settingsPages = [
  {
    path: "about",
    title: "About MiniMart",
    content: `Welcome to MiniMart! 
MiniMart is a user-friendly marketplace where you can buy and sell products effortlessly. Our goal is to connect sellers and buyers in a safe, fast, and reliable platform.`,
    links: []
  },
  {
    path: "terms",
    title: "Terms & Conditions",
    content: `By using MiniMart, you agree to our terms and conditions. 
Please make sure you read them carefully. Using our platform means you accept all rules regarding transactions, listings, and user conduct.`,
    links: []
  },
  {
    path: "privacy",
    title: "Privacy Policy",
    content: `Your privacy is important to us. MiniMart ensures that your personal data is securely stored and never shared with third parties without your consent.`,
    links: []
  },
  {
    path: "make-money",
    title: "How to Make Money",
    content: `MiniMart allows anyone to earn by selling products online. 
Follow these simple steps:
1. Post your products.
2. Use promotions to reach more buyers.
3. Track your sales and earnings.
Start selling today and grow your business!`,
    links: [
      { path: "/profile/make-money/add-product", label: "Add Product Now", icon: <FaArrowRight /> }
    ]
  },
  {
    path: "become-seller",
    title: "Become a Seller",
    content: `Apply to become a verified seller on MiniMart and start selling your products to thousands of users.
Fill out your business info, upload your ID, CAC, and optional documents for verification.`,
    links: [
      { path: "/profile/become-seller", label: "Apply Now", icon: <FaArrowRight /> }
    ]
  }
];