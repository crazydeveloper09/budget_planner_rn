import type { Server } from "socket.io";
import { User } from "../models/User.js";
import { verifyToken } from "./tokens.js";

let io: Server | null = null;

export function attachRealtime(server: Server) {
  io = server;
  io.use(async (socket, next) => {
    const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
    try {
      const payload = verifyToken(token, "access");
      const user = await User.findById(payload.sub);
      if (!user?.totpEnabled) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.householdId = user.householdId ? String(user.householdId) : null;
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
