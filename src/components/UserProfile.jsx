import { useAuth0 } from "@auth0/auth0-react";

export default function UserProfile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  if (!isAuthenticated) {
    return <p>You are not logged in.</p>;
  }

  return (
    <div style={{ padding: "20px", border: "1px solid #ddd" }}>
      <img
        src={user.picture}
        alt={user.name}
        style={{ width: "60px", borderRadius: "50%" }}
      />

      <h3>{user.name}</h3>
      <p>{user.email}</p>

      <button
        onClick={() =>
          logout({
            logoutParams: {
              returnTo: window.location.origin
            }
          })
        }
      >
        Logout
      </button>
    </div>
  );
}