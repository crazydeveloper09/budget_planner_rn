import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "../api/config";

let socket: Socket | null = null;

export function connectLiveSync(token: string, onBudgetUpdated: () => void) {
  disconnectLiveSync();
  socket = io(getApiBaseUrl(), {
    auth: { token },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
  socket.on("connect", onBudgetUpdated);
  socket.on("budget:updated", onBudgetUpdated);
}

export function disconnectLiveSync() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
