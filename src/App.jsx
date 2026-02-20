import { useAuth0 } from "@auth0/auth0-react";

export default function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    isLoading
  } = useAuth0();

  console.log("Authenticated:", isAuthenticated);

  if (isLoading) return <h2>Loading...</h2>;

  return (
    <div style={{ padding: 40 }}>
      <h1>MiniMart Auth Test</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>
          Log In
        </button>
      ) : (
        <>
          <h3>Welcome {user?.name}</h3>
          <button
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Log Out
          </button>
        </>
      )}
    </div>
  );
}