import { io } from "socket.io-client";

console.log("[socket.ts] opts =", {
  path: "/socket.io",
  transports: ["websocket"],
  withCredentials: true,
});

export const socket = io("http://localhost:8080", {
  path: "/socket.io",
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false,
});

// ✅ DEBUG listeners (put them HERE)
socket.on("connect", () => {
  console.log("[socket.ts] connected", socket.id);
});

socket.on("disconnect", () => {
  console.log("[socket.ts] disconnected");
});
