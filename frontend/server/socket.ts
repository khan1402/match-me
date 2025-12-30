import { Server, Socket } from "socket.io";
import cookie from "cookie";
import { verifyToken } from "./auth";
import { updateLastSignIn } from "./db";

/*
 * Simple Socket.IO helper to manage user connections and send
 * real‑time events. Each connected socket is authenticated via
 * the same JWT cookie that protects the REST API (match_me_session).
 * We maintain a map of userId → socket IDs so we can emit events
 * to all active sockets for a given user.
 */

// Map of user IDs to the set of their connected socket IDs.
const userSockets: Map<number, Set<string>> = new Map();

// Keep a reference to the Socket.IO server so we can emit from
// anywhere after registration.
let ioRef: Server | null = null;

/**
 * Attach Socket.IO to the HTTP server and set up connection/auth
 * handlers. Should be called from server/_core/index.ts after
 * creating the HTTP server.
 */
export function registerSocket(io: Server) {
  ioRef = io;

  // Authenticate each incoming socket connection. We extract the
  // `match_me_session` cookie and verify the JWT. If valid, we
  // attach the userId to the socket and allow the connection. If
  // invalid, we reject the connection.
  io.use((socket, next) => {
    try {
      const cookiesHeader = socket.handshake.headers.cookie || "";
      const cookies = cookie.parse(cookiesHeader);
      // The REST API sets the JWT in a cookie named "auth_token" during
      // login (see routes.ts). Use the same cookie for WebSocket auth.
      const token = cookies.auth_token;
      if (!token) return next(new Error("Authentication required"));
      const payload = verifyToken(token);
      if (!payload || typeof payload.userId !== "number") {
        return next(new Error("Invalid token"));
      }
      // Attach the userId to the socket for later use
      (socket as any).userId = payload.userId;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId: number | undefined = (socket as any).userId;
    if (typeof userId !== "number") {
      socket.disconnect(true);
      return;
    }
    // Track this socket for the user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Update last sign in so other users see online status. We
    // intentionally ignore errors here.
    try {
      await updateLastSignIn(userId);
    } catch (err) {
      // No‑op
    }

    // Clean up when the socket disconnects. Remove the socket ID
    // from the user's set, and delete the entry entirely if no
    // sockets remain for that user.
    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });
}

/**
 * Emit an event with payload to all connected sockets for the
 * specified user. Does nothing if the user has no active sockets.
 */
function emitToUser(userId: number, event: string, payload: any) {
  if (!ioRef) return;
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.forEach((socketId) => {
    ioRef!.to(socketId).emit(event, payload);
  });
}

/**
 * Notify a user that a new message has arrived. The payload should
 * be the newly inserted message row so the client can append it
 * directly to its message list.
 */
export function emitMessage(receiverId: number, message: any) {
  emitToUser(receiverId, "message:new", message);
}

/**
 * Notify a user that the other user has started or stopped typing.
 * When `isTyping` is true, a `typing:start` event is emitted; when
 * false, a `typing:stop` event is emitted. The payload includes
 * `matchId` and `fromUserId` so the client knows which chat and
 * who is typing.
 */
export function emitTyping(
  receiverId: number,
  matchId: number,
  fromUserId: number,
  isTyping: boolean
) {
  const eventName = isTyping ? "typing:start" : "typing:stop";
  emitToUser(receiverId, eventName, { matchId, fromUserId });
}