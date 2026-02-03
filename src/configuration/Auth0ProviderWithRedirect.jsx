// src/configuration/Auth0ProviderWithRedirect.jsx
import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const Auth0ProviderWithRedirect = ({ children }) => {
  const navigate = useNavigate();

  // Function called after Auth0 login redirect
  const onRedirectCallback = (appState) => {
    // Navigate to the page user intended, fallback to "/"
    navigate(appState?.returnTo || "/");
  };

  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}       // keep user logged in
      cacheLocation="localstorage"   // persist across refresh
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithRedirect;