import { useAuth0 } from "@auth0/auth0-react";

function Login() {
  const { loginWithRedirect, isAuthenticated, user } = useAuth0();

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", textAlign: "center" }}>
      <h2>Login</h2>

      {!isAuthenticated ? (
        <>
          <p>Please login to continue</p>
          <button
            onClick={() => loginWithRedirect()}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Login with Auth0
          </button>
        </>
      ) : (
        <div>
          <p>Welcome, {user.name || user.email}!</p>
        </div>
      )}
    </div>
  );
}

export default Login;