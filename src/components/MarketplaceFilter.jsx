// src/components/MarketplaceFilter.jsx
import { useState, useEffect } from "react";
import { locationsByState, allStatesByCountry } from "../config/locationsByState";
import categoriesData from "../config/categoriesData";

export default function MarketplaceFilter({ onFilter }) {
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [condition, setCondition] = useState("");

  const [statesList, setStatesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  // Load states when country changes
  useEffect(() => {
    if (country === "Nigeria") setStatesList(Object.keys(locationsByState));
    else setStatesList(allStatesByCountry[country] || []);
    setState("");
    setCity("");
  }, [country]);

  // Load cities when state changes
  useEffect(() => {
    if (!state) return setCitiesList([]);
    setCitiesList(country === "Nigeria" ? locationsByState[state] : []);
    setCity("");
  }, [state, country]);

  // Load categories
  useEffect(() => {
    setCategoriesList(Object.keys(categoriesData));
  }, []);

  // Apply filter
  const handleApply = () => {
    const filters = {
      country, state, city, category, priceMin, priceMax, condition,
    };
    onFilter(filters);
  };

  const handleReset = () => {
    setState(""); setCity(""); setCategory(""); setPriceMin(""); setPriceMax(""); setCondition("");
    onFilter({});
  };

  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "1rem" }}>
      <h4>Marketplace Filter</h4>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {/* Country */}
        <select value={country} onChange={e => setCountry(e.target.value)}>
          <option value="Nigeria">Nigeria</option>
          <option value="Ghana">Ghana</option>
          <option value="Kenya">Kenya</option>
          <option value="Global">Global</option>
        </select>

        {/* State */}
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="">All States</option>
          {statesList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* City */}
        <select value={city} onChange={e => setCity(e.target.value)} disabled={!state}>
          <option value="">All Cities</option>
          {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Category */}
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Price Range */}
        <input
          type="number"
          placeholder="Min Price"
          value={priceMin}
          onChange={e => setPriceMin(e.target.value)}
          style={{ width: "100px" }}
        />
        <input
          type="number"
          placeholder="Max Price"
          value={priceMax}
          onChange={e => setPriceMax(e.target.value)}
          style={{ width: "100px" }}
        />

        {/* Condition */}
        <select value={condition} onChange={e => setCondition(e.target.value)}>
          <option value="">Any Condition</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
          <option value="Refurbished">Refurbished</option>
        </select>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <button onClick={handleApply} style={{ padding: "0.5rem 1rem", background: "#fd7e14", color: "white", border: "none", borderRadius: "4px" }}>Apply</button>
        <button onClick={handleReset} style={{ padding: "0.5rem 1rem", background: "#ccc", border: "none", borderRadius: "4px" }}>Reset</button>
      </div>
    </div>
  );
}