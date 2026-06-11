import cors from "cors";
import express from "express";
import { analyticsRouter } from "./routes/analytics.js";
import { historicalRouter } from "./routes/historical.js";
import { liveRouter } from "./routes/live.js";
import { predictionsRouter } from "./routes/predictions.js";
import { trainsRouter } from "./routes/trains.js";

const app = express();

app.use(cors());
app.use(express.json());

const trains = express.Router();
trains.use(trainsRouter);
trains.use(liveRouter);
trains.use(historicalRouter);
trains.use(analyticsRouter);
trains.use(predictionsRouter);

app.use("/api/v1/trains", trains);

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`RailPulse API listening on http://localhost:${port}`);
});
