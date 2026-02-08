import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithRedirect({ children }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI
      }}
    >
      {children}
    </Auth0Provider>
  );
}