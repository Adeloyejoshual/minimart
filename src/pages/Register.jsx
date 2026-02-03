import { useAuth0 } from "@auth0/auth0-react";

function Register() {
  const { loginWithRedirect, isAuthenticated, user } = useAuth0();

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", textAlign: "center" }}>
      <h2>Register</h2>

      {!isAuthenticated ? (
        <>
          <p>Create an account to get started</p>
          <button
            onClick={() =>
              loginWithRedirect({
                screen_hint: "signup", // This tells Auth0 to show the signup page
              })
            }
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            Sign Up
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

export default Register;