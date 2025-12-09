// server.js
// Proxy InfluxDB + API NebuleSnake (classement global)

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// --------- Middlewares ---------
app.use(cors());

// Corps texte pour /query (Flux InfluxDB)
app.use("/query", express.text({ type: "*/*" }));

// Corps JSON pour l'API Snake
app.use(express.json());

// --------- InfluxDB proxy ---------
const INFLUX_URL =
  "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/query";
const INFLUX_TOKEN = process.env.INFLUX_TOKEN; // stocké dans Render
const ORG = "4ec803aa73783a39";

app.post("/query", async (req, res) => {
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

// Classements par mode
const snakeLeaderboards = {
  lent: [],
  normal: [],
  rapide: []
};

// Stats globales (cumulées)
const globalSnakeStats = {
  totalGames: 0,
  totalPlayTimeSec: 0
};

function sanitizeMode(mode) {
  if (mode === "lent" || mode === "normal" || mode === "rapide") return mode;
  return "normal";
}

function addSnakeScore(mode, name, score, durationSec, achievements) {
  const m = sanitizeMode(mode);
  const cleanName = (name || "Anonyme").toString().slice(0, 20);
  const numericScore = Number(score) || 0;
  const dur = Number(durationSec);

  const ach =
    Array.isArray(achievements) && achievements.length
      ? achievements.slice(0, 5)
      : [];

  snakeLeaderboards[m].push({
    name: cleanName,
    score: numericScore,
    achievements: ach,
    date: new Date().toISOString()
  });

  snakeLeaderboards[m].sort((a, b) => b.score - a.score);
  snakeLeaderboards[m] = snakeLeaderboards[m].slice(0, MAX_ENTRIES);

  if (Number.isFinite(dur) && dur > 0) {
    globalSnakeStats.totalGames += 1;
    globalSnakeStats.totalPlayTimeSec += Math.floor(dur);
  }
}

// GET → récupère tous les classements + stats globales
app.get("/snake/leaderboard", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({
    leaderboards: snakeLeaderboards,
    globalStats: globalSnakeStats
  });
});

// POST → ajoute un score { mode, name, score, durationSec, achievements }
app.post("/snake/leaderboard", (req, res) => {
  const { mode, name, score, durationSec, achievements } = req.body || {};

  if (score === undefined) {
    return res.status(400).json({ error: "Missing score" });
  }

  addSnakeScore(mode, name, score, durationSec, achievements);

  const m = sanitizeMode(mode);
  res.set("Access-Control-Allow-Origin", "*");
  res.json({
    ok: true,
    mode: m,
    leaderboard: snakeLeaderboards[m],
    globalStats: globalSnakeStats
  });
});

// --------- Route racine ---------
app.get("/", (req, res) => {
  res.send("NebuleAir Proxy + NebuleSnake Leaderboard 🐍");
});

// --------- Lancement serveur ---------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
