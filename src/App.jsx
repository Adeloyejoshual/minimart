import { useEffect, useState } from "react";
import { getDBTime, getProducts, addProduct } from "./api";

function App() {
  const [dbTime, setDbTime] = useState("");
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    getDBTime().then(data => setDbTime(data.dbTime));
    getProducts().then(setProducts);
  }, []);

  const handleAdd = async () => {
    if (!name || !price) return alert("Enter name and price!");
    const newProduct = await addProduct(name, price);
    setProducts([newProduct, ...products]); // add to top
    setName("");
    setPrice("");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Live CockroachDB Service</h1>
      <p>DB Time: {dbTime}</p>

      <h2>Add Product</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" />
      <button onClick={handleAdd}>Add</button>

      <h2>Products</h2>
      <ul>
        {products.map(p => (
          <li key={p.id}>{p.name} - ${p.price}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;