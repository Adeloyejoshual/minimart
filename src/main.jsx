// main.jsx - ELIMINATES "Invalid state" FOREVER
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const redirectUri = "https://minimart-ivrm.onrender.com/"; // HARDCODED - NO VARS

console.log('🔍 Auth0 Config:', { domain, clientId: clientId?.slice(0,8)+'...', redirectUri });

if (!domain || !clientId) {
  throw new Error('❌ Missing Auth0 config in Render Environment Variables');
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    authorizationParams={{ 
      redirect_uri: redirectUri
    }}
    // ❌ THESE CAUSE "Invalid state" ON RENDER:
    useRefreshTokens={false}
    cacheLocation="memory" 
  >
    <App />
  </Auth0Provider>
);