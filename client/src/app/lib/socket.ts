import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getBaseUrl() {
  // Optional override (useful if you ever host client separately)
  const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
  if (envUrl) return envUrl;

  // Dev: your server is on 3000
  if (import.meta.env.DEV) return "http://localhost:3000";

  // Prod (Render): same origin (Express serves the built client)
  return window.location.origin;
}

export function getSocket() {
  if (!socket) {
    socket = io(getBaseUrl(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function ensureConnected() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}
