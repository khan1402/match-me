import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoute } from "wouter";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
// Import native WebSocket client and presence manager
import { ws } from "@/lib/websocket";
import { presenceManager } from "@/lib/presence";

const DEBUG_PRESENCE = false; // Set to true to enable verbose presence logging

export default function Chat() {
  const { user } = useAuth();
  const [, params] = useRoute("/chat/:matchId");
  const matchId = params?.matchId ? parseInt(params.matchId) : 0;

  // Info about this match: otherUserId, profile, online, etc.
  const [matchInfo, setMatchInfo] = useState<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  // When the current user is actively typing we notify the server so the
  // other user can see a typing indicator. We track our typing state
  // locally to debounce these notifications but we never display it.
  const [myTyping, setMyTyping] = useState(false);
  // When the other user in the match is typing, we show a "Typing…"
  // indicator in the chat. This state is updated based on incoming
  // typing notifications from the server.
  const [otherTyping, setOtherTyping] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<Map<number, boolean>>(new Map());

  // Timeout ref to track typing indicator auto-hide
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Define functions BEFORE useEffect so they're available when called
  const loadMessages = async () => {
    try {
      const data: any = await api.messages.getMessages(matchId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchInfo = async () => {
    try {
      const data: any = await api.matches.getMyMatches();
      const found = data.matches?.find((m: any) => m.id === matchId);
      if (found) {
        // Normalize otherUserId to number
        const otherUserId = Number(found.otherUserId);
        if (isNaN(otherUserId)) {
          console.error("[Chat] loadMatchInfo: Invalid otherUserId:", found.otherUserId);
          return;
        }
        console.log("[Chat] loadMatchInfo: Found match, otherUserId =", otherUserId, "(normalized, type:", typeof otherUserId, ")");
        setMatchInfo({ ...found, otherUserId }); // Ensure otherUserId is a number
        // DO NOT initialize presence state from matchInfo.online - it's static/always false
        // Presence will come from WebSocket presence:update events only
      }
    } catch (error) {
      console.error(error);
    }
  };

  async function clearChatNotifications(matchId: number) {
    try {
      const data: any = await api.notifications.getMyNotifications();
      const toClear = (data.notifications || []).filter(
        (n: any) =>
          !n.isRead &&
          n.type === "message" &&
          n.relatedMatchId === matchId &&
          n.content !== "typing"
      );
      for (const notif of toClear) {
        await api.notifications.markAsRead(notif.id);
      }
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  }

  // Memoize handlers to ensure stable references for cleanup
  const handleNewMessage = useCallback(async (msg: any) => {
    if (msg.matchId !== matchId) return;
    
    // Skip messages from current user (already added optimistically)
    // This prevents duplicate messages when sender receives their own message via WebSocket
    if (msg.senderId === user?.id) {
      // Update the optimistic message with the real message ID
      setMessages((prev) => {
        // Check if message with this ID already exists (shouldn't happen, but safety check)
        if (prev.some((m) => m.id === msg.id)) {
          return prev; // Already exists with real ID
        }
        
        // Find optimistic message (temp- ID) by matching content and sender within a time window
        // We match by content and sender since temp ID is random
        const existingIndex = prev.findIndex((m) => {
          const isTemp = typeof m.id === 'string' && m.id.startsWith('temp-');
          return isTemp && 
                 m.content === msg.content && 
                 m.senderId === msg.senderId;
        });
        
        if (existingIndex >= 0) {
          // Replace optimistic message with real one (preserves position)
          const updated = [...prev];
          updated[existingIndex] = msg;
          return updated;
        }
        // If optimistic message not found, don't add (it may have been replaced already or removed)
        // This prevents duplicates
        return prev;
      });
      return;
    }
    
    // For messages from other users, dedupe by message ID to prevent duplicates
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) {
        return prev; // Already exists
      }
      return [...prev, msg];
    });
    
    // If the message is from the other user, mark as read
    try {
      await api.messages.markAsRead(matchId);
      // Also clear any unread notifications
      await clearChatNotifications(matchId);
    } catch {
      // ignore
    }
  }, [matchId, user?.id]);

  const handleTypingStart = useCallback((payload: any) => {
    // Show typing indicator if this event belongs to the current match
    // and it's not from the current user.
    if (payload.matchId === matchId && payload.fromUserId !== user?.id) {
      setOtherTyping(true);
      
      // Auto-hide typing indicator after 3 seconds of no new typing events
      // Clear existing timeout if any
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to hide typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        setOtherTyping(false);
        typingTimeoutRef.current = null;
      }, 3000);
    }
  }, [matchId, user?.id]);

  const handleTypingStop = useCallback((payload: any) => {
    if (payload.matchId === matchId && payload.fromUserId !== user?.id) {
      setOtherTyping(false);
      // Clear timeout when typing stops explicitly
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [matchId, user?.id]);

  // Handle presence updates (online/offline status)
  const handlePresenceUpdate = useCallback((payload: any) => {
    if (!payload || payload.userId === undefined || typeof payload.online !== 'boolean') {
      console.warn("[Chat] Invalid presence:update payload:", payload);
      return;
    }

    // CRITICAL: Normalize userId to number to ensure Map key matching works
    const userId = Number(payload.userId);
    if (isNaN(userId)) {
      console.error("[Chat] Invalid userId in presence:update:", payload.userId);
      return;
    }

    if (DEBUG_PRESENCE) {
      console.log("[Chat] Processing presence:update - userId:", userId, "online:", payload.online);
      if (matchInfo?.otherUserId) {
        const normalizedOtherUserId = Number(matchInfo.otherUserId);
        if (userId === normalizedOtherUserId) {
          console.log("[Chat] ✅ Presence update matches otherUserId:", userId);
        }
      }
    }

    // Update presence manager
    presenceManager.update(userId, payload.online);

    // CRITICAL: Create a new Map reference (React requires new object reference for re-render)
    setOnlineStatus((prev) => {
      const updated = new Map(prev);
      updated.set(userId, payload.online);
      if (DEBUG_PRESENCE) {
        console.log("[Chat] Updated onlineStatus map size:", updated.size, "entries:", Array.from(updated.entries()));
      }
      return updated; // Return new Map reference
    });
  }, [matchInfo?.otherUserId]);

  useEffect(() => {
    // Don't run until user is loaded and matchId is valid
    if (!matchId || !user?.id) {
      console.log("[Chat] useEffect: Skipping - matchId =", matchId, "user =", user?.id);
      return;
    }

    // Connect to WebSocket ONCE per app session (singleton pattern)
    // This ensures WebSocket is ready when messages are sent
    console.log("[Chat] useEffect: matchId =", matchId, "user =", user.id);
    ws.connect();

    // Initial load: fetch match info and messages once
    loadMatchInfo();
    loadMessages();
    // Mark existing messages as read so unread counts reset
    api.messages.markAsRead(matchId).catch(() => {});
    // Clear any existing unread message notifications for this match
    clearChatNotifications(matchId);

    // Register WebSocket event handlers
    // Cleanup will always run before re-registration, so no duplicates
    ws.on("message:new", handleNewMessage);
    ws.on("typing:start", handleTypingStart);
    ws.on("typing:stop", handleTypingStop);
    ws.on("presence:update", handlePresenceUpdate);

    // Subscribe to presence updates from presence manager
    // This ensures we get updates from the global presence manager
    const unsubscribePresence = presenceManager.subscribe((presence) => {
      // CRITICAL: Create a new Map reference (React requires new object reference for re-render)
      setOnlineStatus(new Map(presence));
    });

    // Cleanup listeners on unmount or when matchId/user changes
    return () => {
      ws.off("message:new", handleNewMessage);
      ws.off("typing:start", handleTypingStart);
      ws.off("typing:stop", handleTypingStop);
      ws.off("presence:update", handlePresenceUpdate);
      unsubscribePresence();
      // Clear typing timeout on cleanup
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [matchId, user?.id, handleNewMessage, handleTypingStart, handleTypingStop, handlePresenceUpdate]);

  const handleSend = async (e: React.FormEvent) => {
  e.preventDefault();
  const content = newMessage.trim();
  if (!content || !user?.id || !matchInfo?.otherUserId) return;

  // 1) Optimistic UI: show message immediately (so it doesn't "vanish")
  const tempMessage = {
    id: `temp-${Date.now()}`,
    matchId,
    senderId: user.id,
    content,
    createdAt: new Date().toISOString(),
  };

  setMessages((prev) => [...prev, tempMessage]);
  setNewMessage("");

  // 2) Send via REST API to persist to database
  try {
    await api.messages.sendMessage(matchId, matchInfo.otherUserId, content);
  } catch (err) {
    console.error("Failed to send message via API:", err);
    // Remove optimistic message on error
    setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    return;
  }

  // Note: Real-time delivery should be handled by the REST endpoint via socket events
  // The socket.emit("message:send") was removed to avoid duplicate message creation

  // Keep this if you want to clear badges immediately for THIS match
  clearChatNotifications(matchId);
};



  /**
   * Poll for typing notifications. Typing notifications are stored as
   * message-type notifications with content="typing" and indicate
   * that the other user is currently typing. We fetch all notifications
   * and check for any unread typing notifications for this match. If
   * found, we set `otherTyping` to true and mark them as read so they
   * don't accumulate. If none are found, we clear `otherTyping`.
   */
  async function loadTypingNotifications() {
    if (!matchId) return;
    try {
      const data: any = await api.notifications.getMyNotifications();
      const typingNotifs = (data.notifications || []).filter(
        (n: any) =>
          !n.isRead &&
          n.type === "message" &&
          n.relatedMatchId === matchId &&
          n.content === "typing"
      );
      if (typingNotifs.length > 0) {
        setOtherTyping(true);
        // Mark all typing notifications as read so they don't count
        for (const notif of typingNotifs) {
          await api.notifications.markAsRead(notif.id).catch(() => {});
        }
      } else {
        setOtherTyping(false);
      }
    } catch (err) {
      console.error("Failed to load typing notifications", err);
    }
  }

  // Send typing events to the server when the user types in the message
  // box. We debounce to avoid spamming the server with requests on every
  // keystroke. When `newMessage` becomes non-empty we set `myTyping`
  // to true and notify the server via REST API (backend handles WebSocket broadcast).
  useEffect(() => {
    if (!matchId || !matchInfo) return;
    
    // Clear existing timeout if any
    let timeout: NodeJS.Timeout | null = null;
    
    if (newMessage.length > 0) {
      if (!myTyping) {
        setMyTyping(true);
        // Inform server we're typing via REST API (which sends WebSocket event)
        api.messages.typing(matchId, matchInfo.otherUserId, true).catch(() => {});
      }
      // Start or reset a timer to send typing:stop after 2s of inactivity
      timeout = setTimeout(() => {
        setMyTyping(false);
        // Send typing:stop to server (backend should handle this)
        api.messages.typing(matchId, matchInfo.otherUserId, false).catch(() => {});
      }, 2000);
    } else {
      // Input is empty, stop typing immediately
      if (myTyping) {
        setMyTyping(false);
        api.messages.typing(matchId, matchInfo.otherUserId, false).catch(() => {});
      }
    }
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [newMessage, matchId, matchInfo, myTyping]);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-4 sm:p-6 flex flex-col h-[80vh]">
          {/* Header: back button + avatar + name + online status */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {matchInfo && (() => {
              // CRITICAL: Verify otherUserId exists and normalize to number
              if (!matchInfo.otherUserId) {
                console.error("[Chat] ⚠️ matchInfo.otherUserId is missing!");
                return null;
              }

              const otherUserId = Number(matchInfo.otherUserId);
              if (isNaN(otherUserId)) {
                console.error("[Chat] ⚠️ matchInfo.otherUserId is not a valid number:", matchInfo.otherUserId);
                return null;
              }

              // CRITICAL: Use ONLY onlineStatus.get() - DO NOT use matchInfo.online (static/always false)
              const isOnline = onlineStatus.get(otherUserId) ?? false;

              if (DEBUG_PRESENCE) {
                console.log("[PresenceRender] otherUserId:", otherUserId, "isOnline:", isOnline, "map size:", onlineStatus.size);
              }

              return (
              <>
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    {matchInfo.profile?.profilePhotoUrl ? (
                      <AvatarImage
                        src={matchInfo.profile.profilePhotoUrl}
                        alt={matchInfo.profile.firstName}
                      />
                    ) : (
                      <AvatarFallback>👤</AvatarFallback>
                    )}
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-white ${
                        isOnline ? "bg-green-500" : "bg-gray-300"
                    }`}
                      style={{ zIndex: 10 }}
                      title={isOnline ? "Online" : "Offline"}
                  />
                </div>
                <div className="flex flex-col">
                  <p className="font-medium">
                    {matchInfo.profile?.firstName ||
                        `User ${otherUserId}`}
                  </p>
                  <span className="text-xs text-gray-500">
                      {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </>
              );
            })()}
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`max-w-[75%] p-3 rounded-lg relative ${
                    isMe ? "ml-auto bg-rose-100" : "mr-auto bg-gray-100"
                  }`}
                >
                  <p className="text-sm break-words">{msg.content}</p>
                  <span className="absolute bottom-0 right-1 text-[10px] text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
            {otherTyping && (
              <div className="text-sm text-gray-500 italic">Typing…</div>
            )}
          </div>

          {/* Message input */}
          <form onSubmit={handleSend} className="flex gap-2 mt-auto">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
            />
            <Button type="submit">Send</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

