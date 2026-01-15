const express = require("express");
const path = require("path");
const app = express();

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "build")));

// All other GET requests go to React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});