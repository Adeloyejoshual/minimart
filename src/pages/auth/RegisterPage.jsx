import { useAuth0 } from "@auth0/auth0-react";

export default function RegisterPage() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div style={{ padding: "40px" }}>
      <h2>Register</h2>
      <button
        onClick={() =>
          loginWithRedirect({
            authorizationParams: { screen_hint: "signup" }
          })
        }
      >
        Sign up with Auth0
      </button>
    </div>
  );
}