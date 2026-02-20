import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

function HomePage() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    user,
    isLoading
  } = useAuth0();

  if (isLoading) return <h2>Loading...</h2>;

  return (
    <div style={{ padding: 40 }}>
      <h1>MiniMart Marketplace</h1>

      {!isAuthenticated ? (
        <button onClick={() => loginWithRedirect()}>
          Log In
        </button>
      ) : (
        <>
          <h3>Welcome {user?.name}</h3>
          <button
            onClick={() =>
              logout({
                logoutParams: {
                  returnTo: window.location.origin
                }
              })
            }
          >
            Log Out
          </button>
        </>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 40 }}>
      <h2>Page Not Found</h2>
      <Link to="/">Go Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}