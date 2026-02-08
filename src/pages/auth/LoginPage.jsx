import { useAuth0 } from "@auth0/auth0-react";

export default function LoginPage() {
  const { loginWithRedirect, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "40px" }}>
      <h2>Login</h2>
      <button onClick={() => loginWithRedirect()}>
        Login with Auth0
      </button>
    </div>
  );
}