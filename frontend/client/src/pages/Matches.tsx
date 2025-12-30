import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { ws } from "@/lib/websocket";
import { presenceManager } from "@/lib/presence";

export default function Matches() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState<Map<number, boolean>>(new Map());

  useEffect(() => {
    loadMatches();

    // Handle presence updates (online/offline status)
    const handlePresenceUpdate = (payload: any) => {
      console.log("[Matches] handlePresenceUpdate called with payload:", payload);
      if (payload && payload.userId !== undefined && typeof payload.online === 'boolean') {
        // Normalize userId to number
        const userId = Number(payload.userId);
        if (!isNaN(userId)) {
          console.log("[Matches] ✅ Updating presence for userId:", userId, "online:", payload.online);
          presenceManager.update(userId, payload.online);
        }
      }
    };

    // Subscribe to presence updates
    ws.on("presence:update", handlePresenceUpdate);
    const unsubscribePresence = presenceManager.subscribe((presence) => {
      setOnlineStatus(new Map(presence));
    });

    return () => {
      ws.off("presence:update", handlePresenceUpdate);
      unsubscribePresence();
    };
  }, []);

  const loadMatches = async () => {
    try {
      const data: any = await api.matches.getMyMatches();
      const list = data.matches || [];

      list.sort((a: any, b: any) => {
        const aTime = a.lastMessage?.createdAt
          ? new Date(a.lastMessage.createdAt).getTime()
          : new Date(a.matchedAt || 0).getTime();
        const bTime = b.lastMessage?.createdAt
          ? new Date(b.lastMessage.createdAt).getTime()
          : new Date(b.matchedAt || 0).getTime();
        return bTime - aTime;
      });

      setMatches(list);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8 gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Your Matches</h1>
        </div>

        {matches.length === 0 ? (
          <Card className="p-8 text-center">
            <p>No matches yet. Keep swiping!</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches.map((match) => {
              const name = match.profile?.firstName || `User ${match.otherUserId}`;
              const photo =
                match.photoUrl || match.profile?.profilePhotoUrl || null;

              const lastMsg = match.lastMessage;
              const unread = match.unreadCount || 0;
              // Normalize otherUserId to number for Map key matching
              const otherUserId = Number(match.otherUserId);
              // CRITICAL: Use ONLY onlineStatus from presence manager (no fallback to match.online)
              const online = !isNaN(otherUserId) ? (onlineStatus.get(otherUserId) ?? false) : false;

              return (
                <Card key={match.id} className="p-4 flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      {photo ? (
                        <AvatarImage src={photo} alt={name} />
                      ) : (
                        <AvatarFallback>👤</AvatarFallback>
                      )}
                    </Avatar>
                    <span
                      className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-white ${
                        online ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium truncate">{name}</p>
                    {lastMsg ? (
                      <p className="text-sm text-gray-500 truncate">
                        {lastMsg.senderId === user?.id ? "You: " : ""}
                        {lastMsg.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No messages yet</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {lastMsg && (
                      <span className="text-xs text-gray-400">
                        {new Date(lastMsg.createdAt).toLocaleDateString()}{" "}
                        {new Date(lastMsg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}

                    {unread > 0 && (
                      <Badge variant="secondary" className="text-xs px-2 py-1">
                        {unread}
                      </Badge>
                    )}

                    <Button size="sm" onClick={() => setLocation(`/chat/${match.id}`)}>
                      Open
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
