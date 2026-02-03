// src/pages/marketplace/MarketplaceListingDetailsPage.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

export default function MarketplaceListingDetailsPage() {
  const { id } = useParams();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/marketplace/listings/${id}`);
        setListing(res.data);
      } catch (err) {
        setError("Failed to fetch listing details.");
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!listing) return <div className="p-6">Listing not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">{listing.title}</h1>
      <p className="text-gray-700 mb-4">{listing.description}</p>
      <p className="font-semibold mb-4">Price: ${listing.price}</p>

      {isAuthenticated ? (
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Chat with Seller
        </button>
      ) : (
        <button
          onClick={() => loginWithRedirect()}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Login to Chat
        </button>
      )}
    </div>
  );
}