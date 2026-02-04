import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Auth0ProviderWithRedirect from "./configuration/Auth0ProviderWithRedirect.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0ProviderWithRedirect>
      <App />
    </Auth0ProviderWithRedirect>
  </React.StrictMode>
);