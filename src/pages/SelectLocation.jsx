import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { locationsByState } from "../config/locationsByState";
import "./SelectLocation.css";

export default function SelectLocation() {
  const navigate = useNavigate();
  const states = Object.keys(locationsByState);
  const [selectedState, setSelectedState] = useState("");
  const [searchState, setSearchState] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const handleStateSelect = (state) => {
    setSelectedState(state);
    setSelectedCity("");
    setSearchCity("");
  };

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    localStorage.setItem(
      "selectedLocation",
      JSON.stringify({ state: selectedState, city })
    );
    navigate(-1);
  };

  const filteredStates = states.filter((s) =>
    s.toLowerCase().includes(searchState.toLowerCase())
  );

  const filteredCities =
    selectedState && locationsByState[selectedState].filter((c) =>
      c.toLowerCase().includes(searchCity.toLowerCase())
    );

  return (
    <div className="location-page">
      <header className="location-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h2>Select Your Location</h2>
        <div style={{ width: 40 }}></div>
      </header>

      {/* State Selector */}
      <div className="location-section">
        <h3>States</h3>
        <input
          type="text"
          className="search-input"
          placeholder="Search state..."
          value={searchState}
          onChange={(e) => setSearchState(e.target.value)}
        />
        <div className="list-container">
          {filteredStates.map((state) => (
            <div
              key={state}
              className={`list-item ${selectedState === state ? "active" : ""}`}
              onClick={() => handleStateSelect(state)}
            >
              {state}
            </div>
          ))}
        </div>
      </div>

      {/* City Selector */}
      {selectedState && (
        <div className="location-section">
          <h3>Cities in {selectedState}</h3>
          <input
            type="text"
            className="search-input"
            placeholder="Search city..."
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
          />
          <div className="list-container">
            {filteredCities.map((city) => (
              <div
                key={city}
                className={`list-item ${selectedCity === city ? "active" : ""}`}
                onClick={() => handleCitySelect(city)}
              >
                {city}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}