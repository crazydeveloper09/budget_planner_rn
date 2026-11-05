import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "../api/config";

let socket: Socket | null = null;
let activeToken: string | null = null;

export function connectLiveSync(token: string, onBudgetUpdated: () => void) {
  if (socket && activeToken === token) return;
  disconnectLiveSync();
  activeToken = token;
  socket = io(getApiBaseUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });
  socket.on("connect", onBudgetUpdated);
  socket.on("budget:updated", onBudgetUpdated);
}

export function disconnectLiveSync() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  activeToken = null;
}
