import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    getDocs(collection(db, "products")).then(snapshot => {
      setProducts(snapshot.docs.map(doc => doc.data()));
    });
  }, []);

  return (
    <div>
      <h1>MiniMart</h1>
      {products.map((p, i) => (
        <div key={i}>
          <h3>{p.title}</h3>
          <p>₦{p.price}</p>
          {p.media.includes("video") ? (
            <video src={p.media} controls width="300" />
          ) : (
            <img src={p.media} width="300" />
          )}
        </div>
      ))}
    </div>
  );
}