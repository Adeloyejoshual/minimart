const express = require("express");
const router = express.Router();
const { locationsByRegion } = require("../config/locationsByRegion");

// Get all regions
router.get("/regions", (req, res) => {
  res.json(Object.keys(locationsByRegion));
});

// Get states by region
router.get("/states/:region", (req, res) => {
  const region = req.params.region;
  const states = locationsByRegion[region];
  if (!states) return res.status(404).json({ error: "Region not found" });
  res.json(Object.keys(states));
});

// Get LGAs by state
router.get("/lgas/:state", (req, res) => {
  const state = req.params.state;
  let found = false;
  for (const region of Object.values(locationsByRegion)) {
    if (state in region) {
      found = true;
      return res.json(region[state]);
    }
  }
  if (!found) return res.status(404).json({ error: "State not found" });
});

module.exports = router;