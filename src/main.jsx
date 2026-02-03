// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "./styles/globalStyles.css";

// Wrap App with Auth0Provider and use VITE_ env variables
ReactDOM.createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain={import.meta.env.VITE_AUTH0_DOMAIN}
    clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
    authorizationParams={{
      redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
    }}
    useRefreshTokens={true} // keeps session active
    cacheLocation="localstorage" // persist session across refresh
  >
    <App />
  </Auth0Provider>
);