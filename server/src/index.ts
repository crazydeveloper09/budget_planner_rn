import cors from "cors";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import { createServer } from "http";
import mongoose from "mongoose";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { attachRealtime } from "./lib/realtime.js";
import authRoutes from "./routes/auth.js";
import householdRoutes from "./routes/household.js";

async function connectMongo() {
  if (config.mongoUri) {
    await mongoose.connect(config.mongoUri);
    console.log("Połączono z MongoDB");
    return;
  }

  if (config.isProduction) {
    throw new Error("Brak MONGODB_URI albo MONGO_URL. Dodaj plugin MongoDB na Railway.");
  }

  const { MongoMemoryServer } = await import("mongodb-memory-server");
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
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/auth", authRoutes);
  app.use("/", householdRoutes);

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true },
    transports: ["websocket", "polling"],
  });
  attachRealtime(io);

  httpServer.listen(config.port, "0.0.0.0", () => {
    console.log(`API nasłuchuje na porcie ${config.port}`);
  });
}

main().catch((error) => {
  console.error("Nie udało się uruchomić API", error);
  process.exit(1);
});
