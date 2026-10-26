import cors from "cors";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import householdRoutes from "./routes/household.js";

async function connectMongo() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = path.join(here, "../.mongo-data");
  fs.mkdirSync(dbPath, { recursive: true });
  const mem = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: "wiredTiger",
    },
  });
  await mongoose.connect(mem.getUri("budget_planner"));
  console.log("Baza kont działa lokalnie w server/.mongo-data (bez Dockera)");
}

async function main() {
  await connectMongo();
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/auth", authRoutes);
  app.use("/", householdRoutes);
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`API nasłuchuje na porcie ${config.port}`);
  });
}

main().catch((error) => {
  console.error("Nie udało się uruchomić API", error);
  process.exit(1);
});
