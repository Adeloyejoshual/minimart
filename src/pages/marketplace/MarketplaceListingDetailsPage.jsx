import React from "react";
import { useParams } from "react-router-dom";

export default function MarketplaceListingDetailsPage() {
  const { id } = useParams();
  return (
    <div>
      <h1>Marketplace Listing</h1>
      <p>Listing ID: {id}</p>
    </div>
  );
}