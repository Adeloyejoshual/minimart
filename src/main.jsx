import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";

function Main() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(console.error);
  }, []);

  if (!config) return <div>Loading...</div>;

  return (
    <Auth0Provider
      domain={config.auth0Domain}
      clientId={config.auth0ClientId}
      authorizationParams={{ redirect_uri: config.auth0RedirectUri }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <App />
    </Auth0Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Main />);