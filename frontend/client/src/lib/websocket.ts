// Native WebSocket client for real-time communication
// Replaces Socket.IO with native WebSocket at ws://localhost:8080/ws

const DEBUG_WS = false; // Set to true to enable verbose WebSocket logging

type MessageHandler = (data: any) => void;
type EventType = "message:new" | "typing:start" | "typing:stop" | "presence:update" | "connect" | "disconnect" | "error";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<EventType, Set<MessageHandler>> = new Map();
  private isConnecting = false;
  private isConnected = false;
  private hasConnected = false; // Track if we've ever connected in this session

  constructor(url?: string) {
    // Use same origin as API (replace http/https with ws/wss)
    const apiOrigin = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsProtocol = apiOrigin.startsWith("https") ? "wss" : "ws";
    const wsHost = apiOrigin.replace(/^https?:\/\//, "");
    const baseUrl = url || `${wsProtocol}://${wsHost}/ws`;
    this.url = baseUrl; // Will be set with token in connect()
    console.log("[WebSocket] Initialized with base URL:", baseUrl);
  }

  connect() {
    // Singleton pattern: only connect once per app session
    // If already connected or connecting, skip
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log("[WebSocket] Already connected or connecting, readyState:", this.ws?.readyState);
      return;
    }

    // Check if connection is in CLOSING or CLOSED state, reset it
    if (this.ws && (this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED)) {
      console.log("[WebSocket] Resetting closed connection");
      this.ws = null;
      // Allow reconnect after a closed connection (but not multiple simultaneous attempts)
      if (this.hasConnected) {
        // If we've connected before and connection closed, this is a reconnection scenario
        // The reconnection logic will handle it
        this.hasConnected = false;
      }
    }

    this.isConnecting = true;

    // Build WebSocket URL
    // Note: Cookies are NOT sent cross-origin for WebSocket connections
    // The backend accepts token from query parameter as fallback
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
    const wsHost = baseUrl.replace(/^https?:\/\//, "");
    const wsUrl = `${wsProtocol}://${wsHost}/ws`;

    console.log("[WebSocket] Attempting connection to", wsUrl);
    console.log("[WebSocket] Note: Cookie auth_token should be sent automatically (if same-origin)");

    try {
      console.log("[WebSocket] Creating WebSocket instance...");
      this.ws = new WebSocket(wsUrl);
      console.log("[WebSocket] WebSocket instance created, readyState:", this.ws.readyState);

      this.ws.onopen = () => {
        console.log("[WebSocket] Connected");
        this.isConnecting = false;
        this.isConnected = true;
        this.hasConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connect", {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (DEBUG_WS) {
            console.log("[WS RAW]", event.data);
            console.log("[WS TYPE]", message?.type, "full message:", message);
          }
          
          if (message.type && message.payload !== undefined) {
            if (DEBUG_WS && message.type === "presence:update") {
              console.log("[WS] ✅ presence:update detected! payload:", message.payload);
            }
            
            // Emit the event (handler will be called)
            this.emit(message.type as EventType, message.payload);
          } else {
            console.warn("[WebSocket] Invalid message format - missing type or payload:", message);
          }
        } catch (err) {
          console.error("[WebSocket] Error parsing message:", err, event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        this.isConnecting = false;
        this.emit("error", error);
      };

      this.ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected", event.code, event.reason);
        this.isConnecting = false;
        this.isConnected = false;
        this.ws = null;
        this.emit("disconnect", { code: event.code, reason: event.reason });

        // When WebSocket disconnects, mark all users as offline in presence manager
        // This prevents stale "online" status when connection drops
        import("@/lib/presence").then(({ presenceManager }) => {
          presenceManager.markAllOffline();
        }).catch(() => {
          // Ignore import errors
        });

        // Attempt reconnect (but don't reconnect if explicitly disconnected)
        if (!this.hasConnected || this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * this.reconnectAttempts;
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), delay);
        }
      };
    } catch (err) {
      console.error("[WebSocket] Connection error:", err);
      this.isConnecting = false;
      this.emit("error", err);
    }
  }

  disconnect() {
    // Prevent reconnection when explicitly disconnected
    this.hasConnected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    
    // Mark all users as offline when explicitly disconnecting
    import("@/lib/presence").then(({ presenceManager }) => {
      presenceManager.markAllOffline();
    }).catch(() => {
      // Ignore import errors
    });
  }

  on(event: EventType, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: EventType, handler: MessageHandler) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: EventType, data: any) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      if (DEBUG_WS) {
        console.log(`[WS Emit] Event "${event}" has ${handlers.size} handler(s)`, data);
      }
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[WebSocket] Error in handler for ${event}:`, err);
        }
      });
    } else if (DEBUG_WS) {
      console.warn(`[WS Emit] Event "${event}" has NO handlers registered!`);
    }
  }

  send(type: string, payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send, not connected");
      return;
    }

    try {
      const message = JSON.stringify({ type, payload });
      this.ws.send(message);
      console.log("[WebSocket] Sent:", { type, payload });
    } catch (err) {
      console.error("[WebSocket] Send error:", err);
    }
  }

  get connected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const ws = new WebSocketClient();

