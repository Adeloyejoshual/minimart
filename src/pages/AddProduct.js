import React from "react";
import PostAdForm from "../components/PostAdForm";

const AddProduct = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: "#f4f4f4",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <PostAdForm />
    </div>
  );
};

export default AddProduct;