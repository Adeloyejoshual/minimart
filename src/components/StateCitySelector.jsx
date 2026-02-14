// src/components/StateCitySelector.jsx
import { useState, useEffect, useRef } from "react";
import { locationsByState, popularCities } from "../config/locationsByState";

export default function StateCitySelector({ state, setState, city, setCity }) {
  const [stateQuery, setStateQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [filteredStates, setFilteredStates] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);
  const [stateIndex, setStateIndex] = useState(-1);
  const [cityIndex, setCityIndex] = useState(-1);

  const stateRef = useRef();
  const cityRef = useRef();

  // Filter states
  useEffect(() => {
    const query = stateQuery.toLowerCase();
    const results = Object.keys(locationsByState).filter(s => s.toLowerCase().includes(query));
    setFilteredStates(results);
    setStateIndex(-1);
  }, [stateQuery]);

  // Filter cities
  useEffect(() => {
    if (!state) return setFilteredCities([]);
    const query = cityQuery.toLowerCase();
    const allCities = [...(popularCities[state] || []), ...(locationsByState[state] || [])];
    const results = allCities.filter(c => c.toLowerCase().includes(query));
    setFilteredCities(results);
    setCityIndex(-1);
  }, [cityQuery, state]);

  // Handle keyboard navigation
  const handleKeyDown = (e, type) => {
    if (type === "state") {
      if (e.key === "ArrowDown") setStateIndex(prev => Math.min(prev + 1, filteredStates.length - 1));
      if (e.key === "ArrowUp") setStateIndex(prev => Math.max(prev - 1, 0));
      if (e.key === "Enter" && filteredStates[stateIndex]) {
        const selected = filteredStates[stateIndex];
        setState(selected);
        setStateQuery(selected);
        setCity("");
        setCityQuery("");
        setStateIndex(-1);
      }
    } else if (type === "city") {
      if (e.key === "ArrowDown") setCityIndex(prev => Math.min(prev + 1, filteredCities.length - 1));
      if (e.key === "ArrowUp") setCityIndex(prev => Math.max(prev - 1, 0));
      if (e.key === "Enter" && filteredCities[cityIndex]) {
        const selected = filteredCities[cityIndex];
        setCity(selected);
        setCityQuery(selected);
        setCityIndex(-1);
      }
    }
  };

  return (
    <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
      {/* State Selector */}
      <div>
        <label>State</label>
        <input
          ref={stateRef}
          type="text"
          placeholder="Search State..."
          value={stateQuery}
          onChange={e => setStateQuery(e.target.value)}
          onKeyDown={e => handleKeyDown(e, "state")}
          style={{ width: "100%", padding: "8px", marginBottom: "4px" }}
        />
        <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #ccc", borderRadius: "4px" }}>
          {filteredStates.map((s, i) => (
            <div
              key={s}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                backgroundColor: i === stateIndex ? "#fd7e14" : s === state ? "#ffc685" : "white",
                color: i === stateIndex ? "white" : "#222",
              }}
              onClick={() => {
                setState(s);
                setStateQuery(s);
                setCity("");
                setCityQuery("");
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* City Selector */}
      <div>
        <label>City / LGA</label>
        <input
          ref={cityRef}
          type="text"
          placeholder="Search City..."
          value={cityQuery}
          onChange={e => setCityQuery(e.target.value)}
          onKeyDown={e => handleKeyDown(e, "city")}
          disabled={!state}
          style={{ width: "100%", padding: "8px", marginBottom: "4px" }}
        />
        <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #ccc", borderRadius: "4px" }}>
          {filteredCities.map((c, i) => (
            <div
              key={c}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                backgroundColor: i === cityIndex ? "#fd7e14" : c === city ? "#ffc685" : "white",
                color: i === cityIndex ? "white" : "#222",
              }}
              onClick={() => {
                setCity(c);
                setCityQuery(c);
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}