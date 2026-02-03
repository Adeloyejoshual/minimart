import { useAuth0 } from "@auth0/auth0-react";

const HeaderNavigation = () => {
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();

  return (
    <header>
      <h1>MiniMart & Marketplace</h1>

      {isAuthenticated ? (
        <>
          <span>Welcome {user.name}</span>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
            Logout
          </button>
        </>
      ) : (
        <button onClick={() => loginWithRedirect()}>Login</button>
      )}
    </header>
  );
};

export default HeaderNavigation;