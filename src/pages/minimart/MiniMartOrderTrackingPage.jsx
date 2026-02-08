import React from "react";
import { useParams } from "react-router-dom";

export default function MiniMartOrderTrackingPage() {
  const { id } = useParams();
  return (
    <div>
      <h1>Order Tracking</h1>
      <p>Tracking ID: {id}</p>
    </div>
  );
}