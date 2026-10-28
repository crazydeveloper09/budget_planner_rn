import type { Server } from "socket.io";
import { verifyToken } from "./tokens.js";

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
    try {
      const payload = verifyToken(token, "access");
      socket.data.householdId = payload.householdId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    const householdId = socket.data.householdId as string | null;
    if (householdId) socket.join(`household:${householdId}`);
  });
}

export function notifyHousehold(householdId: string | null | undefined) {
  if (!io || !householdId) return;
  io.to(`household:${householdId}`).emit("budget:updated");
}
