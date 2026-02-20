// main.jsx - FIXED for Render "Invalid state" error
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";

// Load env vars with production validation
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin;

// 🚀 CRITICAL FIX: Normalize redirect URI (trailing slash)
const normalizedRedirectUri = redirectUri.endsWith('/') ? redirectUri : `${redirectUri}/`;

console.log('🔍 Auth0 Config:', { 
  domain, 
  clientId: clientId?.slice(0, 8) + '...', 
  redirectUri: normalizedRedirectUri 
});

// Validate required config BEFORE rendering
if (!domain || !clientId) {
  throw new Error(`
    ❌ Missing Auth0 config! 
    Check Render Environment Variables:
    - VITE_AUTH0_DOMAIN=dev-akuuw0q85johcauu.us.auth0.com
    - VITE_AUTH0_CLIENT_ID=DLaOqwRXO8XXVaAv57cJQAToorkV0x7y
  `);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ 
        redirect_uri: normalizedRedirectUri,  // ✅ FIXES "Invalid state"
        prompt: "login"  // Forces fresh login
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
      // 30min cache to prevent stale state
      cacheMaxAge={5 * 60 * 1000}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);