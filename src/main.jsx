import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;     // e.g., dev-akuuw0q85johcauu.us.auth0.com
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID; // e.g., DLaOqwRXO8XXVaAv57cJQAToorkV0x7y
const audience = import.meta.env.VITE_AUTH0_AUDIENCE; // optional, if using your API

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience, // optional
      }}
      useRefreshTokens={true}       // keeps the user logged in
      cacheLocation="localstorage"   // persist login across refresh
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);