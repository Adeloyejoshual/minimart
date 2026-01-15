import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function FeaturedAds() {
  const [ads, setAds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAds = async () => {
      const q = query(
        collection(db, "ads"),
        where("active", "==", true),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setAds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadAds();
  }, []);

  if (ads.length === 0) return null;

  return (
    <div style={{
      display: "flex",
      overflowX: "auto",
      gap: 15,
      padding: "15px 0",
      backgroundColor: "#f8f9fa",
      borderRadius: 10,
      marginBottom: 20
    }}>
      {ads.map(ad => (
        <div
          key={ad.id}
          onClick={() => navigate(ad.link)}
          style={{
            minWidth: 300,
            height: 140,
            cursor: "pointer",
            borderRadius: 10,
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
            position: "relative",
          }}
        >
          <img
            src={ad.imageUrl}
            alt={ad.title || "Ad"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {ad.title && (
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              padding: "5px 10px",
              backgroundColor: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontWeight: "bold",
              fontSize: 14,
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10
            }}>
              {ad.title}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}