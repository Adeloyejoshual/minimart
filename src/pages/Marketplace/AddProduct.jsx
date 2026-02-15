import { useState } from "react";

export default function AddProduct() {
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [price, setPrice] = useState("");
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
e.preventDefault();

if (!title || !price) {  
  alert("Title and price are required");  
  return;  
}  

try {  
  setLoading(true);  

  const response = await fetch("/api/marketplace", {  
    method: "POST",  
    headers: {  
      "Content-Type": "application/json",  
    },  
    body: JSON.stringify({  
      title,  
      description,  
      price,  
    }),  
  });  

  const data = await response.json();  

  if (!response.ok) {  
    throw new Error(data.message || "Failed to add product");  
  }  

  alert("Product added successfully!");  

  setTitle("");  
  setDescription("");  
  setPrice("");  
} catch (error) {  
  console.error("Add product error:", error);  
  alert("Failed to add product");  
} finally {  
  setLoading(false);  
}

};

return (
<div style={{ maxWidth: "400px", margin: "40px auto" }}>
<h2>Add Product</h2>

<form onSubmit={handleSubmit}>  
    <div style={{ marginBottom: "15px" }}>  
      <input  
        type="text"  
        placeholder="Title"  
        value={title}  
        onChange={(e) => setTitle(e.target.value)}  
        style={{ width: "100%", padding: "10px" }}  
      />  
    </div>  

    <div style={{ marginBottom: "15px" }}>  
      <textarea  
        placeholder="Description"  
        value={description}  
        onChange={(e) => setDescription(e.target.value)}  
        style={{ width: "100%", padding: "10px" }}  
      />  
    </div>  

    <div style={{ marginBottom: "15px" }}>  
      <input  
        type="number"  
        placeholder="Price"  
        value={price}  
        onChange={(e) => setPrice(e.target.value)}  
        style={{ width: "100%", padding: "10px" }}  
      />  
    </div>  

    <button  
      type="submit"  
      disabled={loading}  
      style={{  
        width: "100%",  
        padding: "10px",  
        background: "black",  
        color: "white",  
        border: "none",  
        cursor: "pointer",  
      }}  
    >  
      {loading ? "Adding..." : "Add Product"}  
    </button>  
  </form>  
</div>

);
}