import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import Auth0ProviderWithRedirect from "./configuration/Auth0ProviderWithRedirect.jsx";

import "./styles/globalStyles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithRedirect>
        <App />
      </Auth0ProviderWithRedirect>
    </BrowserRouter>
  </React.StrictMode>
);