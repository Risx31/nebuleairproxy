// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// =======================================================
//  MIDDLEWARES GLOBAUX
// =======================================================

// CORS partout
app.use(cors());

// Parser JSON par défaut (pour le Snake)
app.use(express.json());

// =======================================================
//  INFLUXDB – PROXY /query
// =======================================================

const INFLUX_URL =
  "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/query";
const INFLUX_TOKEN = process.env.INFLUX_TOKEN; // 🔐 stocké côté Render
const ORG = "4ec803aa73783a39"; // pas utilisé mais tu peux le garder

// ⚠️ Pour /query on veut le body brut (Flux), donc on ajoute express.text
app.post("/query", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const influxResponse = await fetch(INFLUX_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${INFLUX_TOKEN}`,
        "Content-Type": "application/vnd.flux",
        Accept: "application/csv",
        "Accept-Encoding": "identity"
      },
      body: req.body
    });

    const csv = await influxResponse.text();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "text/plain");
    res.send(csv);
  } catch (err) {
    console.error("[Proxy] Erreur Influx :", err);
    res.status(500).send("Erreur proxy");
  }
});

// =======================================================
//        SNAKE – API CLASSEMENT GLOBAL
// =======================================================

const MAX_ENTRIES = 10;
const snakeLeaderboards = {
  lent: [],
  normal: [],
  rapide: []
};

function sanitizeMode(mode) {
  if (mode === "lent" || mode === "normal" || mode === "rapide") return mode;
  return "normal";
}

function addSnakeScore(mode, name, score) {
  const m = sanitizeMode(mode);
  const cleanName = (name || "Anonyme").toString().slice(0, 20);
  const numericScore = Number(score) || 0;

  snakeLeaderboards[m].push({
    name: cleanName,
    score: numericScore,
    date: new Date().toISOString()
  });

  // tri décroissant + top 10
  snakeLeaderboards[m].sort((a, b) => b.score - a.score);
  snakeLeaderboards[m] = snakeLeaderboards[m].slice(0, MAX_ENTRIES);
}

// GET → récupère tous les classements
app.get("/snake/leaderboard", (req, res) => {
  res.json(snakeLeaderboards);
});

// POST → ajoute un score { mode, name, score }
app.post("/snake/leaderboard", (req, res) => {
  const { mode, name, score } = req.body || {};

  if (score === undefined) {
    return res.status(400).json({ error: "Missing score" });
  }

  addSnakeScore(mode, name, score);

  const m = sanitizeMode(mode);
  res.json({
    ok: true,
    mode: m,
    leaderboard: snakeLeaderboards[m]
  });
});

// =======================================================
//  ROUTE RACINE & LANCEMENT
// =======================================================

app.get("/", (req, res) => {
  res.send("NebuleAir Proxy + NebuleSnake Leaderboard 🐍🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
