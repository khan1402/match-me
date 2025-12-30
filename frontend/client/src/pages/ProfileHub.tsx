import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Compass,
  LogOut,
  Heart,
  MessageCircle,
  User as UserIcon,
  Check,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type MyProfileData = {
  id: number;
  firstName?: string | null;
  age?: number | null;
  gender?: string | null;
  lookingFor?: string | null;
  location?: string | null;
  bio?: string | null;
  isVerified?: boolean | null;
  // Optional profile photo URL for avatars; not present on older API versions
  profilePhotoUrl?: string | null;
};

type LikeItem = {
  otherUserId: number;
  profile: MyProfileData | null;
  // some APIs may also return a direct photoUrl
  photoUrl?: string | null;
};

type MatchItem = {
  id: number;
  otherUserId: number;
  matchedAt: string;
  profile: MyProfileData | null;
  // some APIs may also return a direct photoUrl
  photoUrl?: string | null;
  lastMessage?: {
    id: number;
    matchId: number;
    senderId: number;
    receiverId: number;
    content: string;
    createdAt: string;
    isRead?: boolean;
  } | null;
  unreadCount?: number;
  online?: boolean;
};

type Photo = {
  id: number;
  photoUrl: string;
  displayOrder: number;
};

export default function MyProfile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [myProfile, setMyProfile] = useState<MyProfileData | null>(null);
  const [likes, setLikes] = useState<LikeItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Incoming connection requests (users who liked me but I have not yet responded)
  const [requests, setRequests] = useState<any[]>([]);

  // Number of unread chat message notifications
  const [notifCount, setNotifCount] = useState(0);

  const [tabValue, setTabValue] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (
        t === "edit" ||
        t === "likes" ||
        t === "requests" ||
        t === "connections" ||
        t === "chats"
      ) {
        return t;
      }
    }
    return "connections";
  });

  // Simple helper to pick a photo from different possible shapes
  const pickUserPhoto = (obj: any): string | undefined => {
    return (
      obj?.photoUrl ||
      obj?.profile?.profilePhotoUrl ||
      obj?.profilePhotoUrl ||
      undefined
    );
  };

  // ✅ Fix: resolve request user id across possible backend shapes
  const getRequestUserId = (req: any): number | undefined => {
    const id =
      req?.otherUserId ?? // preferred
      req?.userId ?? // Go LikeItem json tag often uses userId
      req?.profile?.id; // fallback
    return typeof id === "number" && Number.isFinite(id) ? id : undefined;
  };

  const loadMatches = async () => {
    try {
      const data: any = await api.matches.getMyMatches();
      let list: MatchItem[] = data.matches || [];

      // Sort by last message timestamp (descending). If no messages,
      // fallback to match creation time.
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

      // Compute total unread messages across all matches
      let total = 0;
      list.forEach((m: any) => {
        if (m.unreadCount && typeof m.unreadCount === "number") {
          total += m.unreadCount;
        }
      });
      setNotifCount(total);
    } catch (err) {
      console.error("Failed to load matches", err);
    }
  };

  const loadRequests = async () => {
    try {
      const data: any = await api.connectionRequests.getIncoming();
      setRequests(data.requests || []);
    } catch (err) {
      console.error("Failed to load connection requests", err);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [profileRes, likesRes, photosRes] = await Promise.all([
          api.profile.getMyProfile() as Promise<MyProfileData>,
          api.likes.getMyLikes() as Promise<{ likes: LikeItem[] }>,
          api.photos.getMyPhotos() as Promise<any>,
        ]);

        setMyProfile(profileRes);
        setLikes(likesRes.likes || []);

        const photosArray: Photo[] = photosRes?.photos ?? photosRes ?? [];
        setPhotos(photosArray);

        await loadMatches();
        await loadRequests();
      } catch (error: any) {
        console.error("Failed to load profile hub data:", error);
        toast.error(error?.message || "Failed to load profile data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function pollMatches() {
      if (!isMounted) return;
      await loadMatches();
      await loadRequests();
    }

    pollMatches();
    const interval = setInterval(pollMatches, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const displayName =
    myProfile?.firstName || user?.name || user?.email || "My Profile";

  // ✅ Take the *latest* uploaded photo (last in array)
  const profilePhoto = photos.length > 0 ? photos[photos.length - 1] : null;

  const avatarSrc =
    myProfile?.profilePhotoUrl ||
    profilePhoto?.photoUrl ||
    user?.profilePicture ||
    undefined;

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore backend error
    }
    await logout();
    setLocation("/");
  };

  const renderProfileSummary = () => {
    if (!myProfile) {
      return (
        <p className="text-sm text-gray-500">
          You haven&apos;t completed your profile yet. Use the{" "}
          <span className="font-semibold">Edit Profile</span> tab to add your
          details.
        </p>
      );
    }

    return (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          <span className="font-semibold">Name:</span> {myProfile.firstName}
        </p>
        {myProfile.age && (
          <p>
            <span className="font-semibold">Age:</span> {myProfile.age}
          </p>
        )}
        {myProfile.location && (
          <p>
            <span className="font-semibold">Location:</span> {myProfile.location}
          </p>
        )}
        {myProfile.lookingFor && (
          <p>
            <span className="font-semibold">Looking for:</span>{" "}
            {myProfile.lookingFor}
          </p>
        )}
        {myProfile.bio && (
          <p>
            <span className="font-semibold">Bio:</span> {myProfile.bio}
          </p>
        )}
      </div>
    );
  };

  const handleAcceptRequest = async (fromUserId: number) => {
    try {
      await api.connectionRequests.accept(fromUserId);
      toast.success("Connection request accepted");
      await loadRequests();
      await loadMatches();
    } catch (err: any) {
      console.error("Accept request error", err);
      toast.error(err?.message || "Failed to accept request");
    }
  };

  const handleRejectRequest = async (fromUserId: number) => {
    try {
      await api.connectionRequests.reject(fromUserId);
      toast.success("Connection request rejected");
      await loadRequests();
    } catch (err: any) {
      console.error("Reject request error", err);
      toast.error(err?.message || "Failed to reject request");
    }
  };

  const handleDisconnect = async (matchId: number) => {
    try {
      await api.matches.disconnect(matchId);
      toast.success("Disconnected");
      await loadMatches();
      await loadRequests();
    } catch (err: any) {
      console.error("Disconnect error", err);
      toast.error(err?.message || "Failed to disconnect");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback>
                {displayName
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                {myProfile?.isVerified && (
                  <Badge variant="secondary" className="text-xs">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">
                All your matches, likes, chats & settings in one place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              aria-label="Home"
            >
              <Home className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/discovery")}
              aria-label="Discovery"
            >
              <Compass className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <Card className="p-4 sm:p-6">
          <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </TabsTrigger>

              <TabsTrigger value="likes" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Liked</span>
              </TabsTrigger>

              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                <span className="hidden sm:inline">Requests</span>
                {requests.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 px-1 py-0 text-[10px]"
                  >
                    {requests.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="connections" className="flex items-center gap-2">
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                <span className="hidden sm:inline">Connections</span>
                {notifCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 px-1 py-0 text-[10px]"
                  >
                    {notifCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="chats" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Chats</span>
                {notifCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-1 px-1 py-0 text-[10px]"
                  >
                    {notifCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Edit Profile */}
            <TabsContent value="edit" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Edit your profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderProfileSummary()}
                  <Button className="mt-4" onClick={() => setLocation("/edit-profile")}>
                    Open full profile editor
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* People I liked */}
            <TabsContent value="likes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>People you liked</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : likes.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      You haven&apos;t liked anyone yet. Go to{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setLocation("/discovery")}
                      >
                        Discovery
                      </button>{" "}
                      to start exploring profiles.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {likes.map((item) => {
                        const name = item.profile?.firstName || `User ${item.otherUserId}`;
                        const photo = pickUserPhoto(item);

                        return (
                          <div
                            key={item.otherUserId}
                            className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                {photo ? (
                                  <AvatarImage src={photo} alt={name} />
                                ) : (
                                  <AvatarFallback>👤</AvatarFallback>
                                )}
                              </Avatar>

                              <div>
                                <p className="font-medium">{name}</p>
                                <p className="text-xs text-gray-500">
                                  {item.profile?.age ? `${item.profile.age} · ` : ""}
                                  {item.profile?.location || "No location yet"}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLocation(`/profile/${item.otherUserId}`)}
                              >
                                View profile
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Connections / mutual matches */}
            <TabsContent value="connections" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Connections (mutual matches)</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : matches.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      You don&apos;t have any mutual matches yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {matches.map((match) => {
                        const name = match.profile?.firstName || `User ${match.otherUserId}`;
                        const photo = pickUserPhoto(match);

                        return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                {photo ? (
                                  <AvatarImage src={photo} alt={name} />
                                ) : (
                                  <AvatarFallback>👤</AvatarFallback>
                                )}
                              </Avatar>

                              <div>
                                <p className="font-medium">{name}</p>
                                <p className="text-xs text-gray-500">
                                  {match.profile?.age ? `${match.profile.age} · ` : ""}
                                  {match.profile?.location || "No location yet"}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 items-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLocation(`/profile/${match.otherUserId}`)}
                              >
                                View profile
                              </Button>

                              <Button size="sm" onClick={() => setLocation(`/chat/${match.id}`)}>
                                Open chat
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDisconnect(match.id)}
                                aria-label="Disconnect"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Incoming like/connection requests */}
            <TabsContent value="requests" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Incoming requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : requests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      You don&apos;t have any incoming likes yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((req) => {
                        const reqUserId = getRequestUserId(req);

                        // If something is malformed, don't break the whole page.
                        if (!reqUserId) {
                          const fallbackName = req?.profile?.firstName || "User";
                          return (
                            <div
                              key={Math.random()}
                              className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 opacity-70"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>👤</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{fallbackName}</p>
                                  <p className="text-xs text-gray-500">
                                    Invalid request item (missing user id)
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const name =
                          req.profile?.firstName || `User ${reqUserId}`;
                        const photo = pickUserPhoto(req);

                        return (
                          <div
                            key={reqUserId}
                            className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                {photo ? (
                                  <AvatarImage src={photo} alt={name} />
                                ) : (
                                  <AvatarFallback>👤</AvatarFallback>
                                )}
                              </Avatar>

                              <div>
                                <button
                                  type="button"
                                  onClick={() => setLocation(`/profile/${reqUserId}`)}
                                  className="font-medium hover:text-rose-600 hover:underline cursor-pointer text-left"
                                >
                                  {name}
                                </button>
                                <p className="text-xs text-gray-500">
                                  {req.profile?.age ? `${req.profile.age} · ` : ""}
                                  {req.profile?.location || "No location"}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-1 items-center">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleAcceptRequest(reqUserId)}
                                aria-label="Accept request"
                              >
                                <Check className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleRejectRequest(reqUserId)}
                                aria-label="Reject request"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chats */}
            <TabsContent value="chats" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your chats</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                  ) : matches.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Start a conversation by matching with someone first.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {matches.map((match) => {
                        const name = match.profile?.firstName || `User ${match.otherUserId}`;
                        const photo = pickUserPhoto(match);
                        const lastMsg: any = match.lastMessage;
                        const unread = match.unreadCount || 0;
                        const online = match.online;

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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
