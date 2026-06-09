import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon } from "./icons";

const FAB = memo(function FAB({ user }) {
  const navigate = useNavigate();

  return (
    <button
      className="mp-fab"
      onClick={() => navigate(user ? "/minimart/post-ad" : "/auth")}
      aria-label="Post an ad"
    >
      <PlusIcon size={16} />
      <span>Post Ad</span>
    </button>
  );
});

export default FAB;