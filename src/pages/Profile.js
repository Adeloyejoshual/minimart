import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";

export default function Profile() {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
      setUserData(snap.data());
    };
    load();
  }, []);

  return (
    <>
      <TopNav />
      <h3>{auth.currentUser.email}</h3>
      <p>Role: {userData?.role}</p>
      <p>Verified: {userData?.verified ? "Yes" : "No"}</p>
      <button onClick={() => signOut(auth)}>Logout</button>
    </>
  );
}