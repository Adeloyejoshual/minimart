import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Auth0ProviderWithRedirect from "./configuration/Auth0ProviderWithRedirect.jsx";
import "./styles/globalStyles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <Auth0ProviderWithRedirect>
    <App />
  </Auth0ProviderWithRedirect>
);