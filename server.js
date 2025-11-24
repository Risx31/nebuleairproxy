import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.text({ type: "*/*" }));

const INFLUX_URL = "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/query";
const INFLUX_TOKEN = process.env.INFLUX_TOKEN; // 🔐 stocké côté Render
const ORG = "4ec803aa73783a39";

app.post("/query", async (req, res) => {
  try {
    const influxResponse = await fetch(INFLUX_URL, {
      method: "POST",
      headers: {
        "Authorization": `Token ${INFLUX_TOKEN}`,
        "Content-Type": "application/vnd.flux",
        "Accept": "application/csv",
        "Accept-Encoding": "identity"
      },
      body: req.body
    });

    const csv = await influxResponse.text();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", "text/plain");
    res.send(csv);

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur proxy");
  }
});

app.get("/", (req, res) => {
  res.send("NebuleAir Proxy actif 🚀");
});

app.listen(10000, () => console.log("Proxy running on port 10000"));
