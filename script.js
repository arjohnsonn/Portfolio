const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = 3000;

app.get("/games", async (req, res) => {
  try {
    const response = await fetch(
      "https://games.roblox.com/v1/games?universeIds=4221645607"
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
