import { useState, useEffect } from "react";
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
    const newProduct = await addProduct(name, price);
    setProducts([...products, newProduct]);
    setName("");
    setPrice("");
  };

  return (
    <div style={{ padding: "20px" }}>
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