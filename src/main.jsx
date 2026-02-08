import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import Auth0ProviderWithRedirect from "./configuration/Auth0ProviderWithRedirect.jsx";
import SyncUser from "./components/SyncUser.jsx";
import "./styles/globalStyles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Auth0ProviderWithRedirect>
      <SyncUser />
      <App />
    </Auth0ProviderWithRedirect>
  </BrowserRouter>
);