const express = require("express");
const path = require("path");
const cors = require("cors");
const locationsRouter = require("./api/locations"); // import your API routes

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors());

// Parse JSON
app.use(express.json());

// API routes
app.use("/api/locations", locationsRouter);

// Serve static files from React app
app.use(express.static(path.join(__dirname, "../build")));

// All other GET requests go to React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});