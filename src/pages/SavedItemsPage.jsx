import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function SavedItemsPage() {
  const [savedItems, setSavedItems] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const savedRef = collection(db, "savedItems");
    const q = query(savedRef, where("userId", "==", uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedItems(items);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>💾 Saved Items</h2>
      {savedItems.length === 0 ? (
        <p>No saved items yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {savedItems.map(item => (
            <li key={item.id} style={{
              padding: 10,
              marginBottom: 8,
              border: "1px solid #ddd",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <strong>{item.name}</strong>
                <div>Price: ₦{item.price}</div>
              </div>
              <div>💾</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}