import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // main global styles

// Include Paystack inline script dynamically
const loadPaystack = () => {
  if (!window.PaystackPop) {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);
  }
};

loadPaystack();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);