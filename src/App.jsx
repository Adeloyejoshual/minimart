import { useAuth0 } from "@auth0/auth0-react";

function App() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading
  } = useAuth0();

  if (isLoading) {
    return <div style={{ textAlign: "center", marginTop: "100px" }}>Loading...</div>;
  }

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>🚀 Auth0 Test</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>
          Login
        </button>
      ) : (
        <>
          <img
            src={user.picture}
            alt="profile"
            style={{ borderRadius: "50%", width: "100px" }}
          />
          <h2>{user.name}</h2>
          <p>{user.email}</p>

          <button
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}

export default App;