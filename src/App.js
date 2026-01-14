import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import { doc, getDoc } from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().blocked) {
          auth.signOut();
          alert("Your MiniMart account has been blocked.");
          setUser(null);
        } else {
          setUser(u);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <><Login /><Register /></>;

  return <Home />;
}

export default App;