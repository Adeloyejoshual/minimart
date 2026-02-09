import React from "react";
import { useParams, Link } from "react-router-dom";

export default function ListingDetails() {
  const { id } = useParams();
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Listing Details</h1>
      <p>Viewing listing ID: {id}</p>
      <Link to="/">Back to Home</Link>
    </div>
  );
}