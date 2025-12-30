import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Home, LogOut, MapPin, HeartHandshake, MessageCircle } from "lucide-react";
import { toast } from "sonner";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// isValidCoordinate checks if coordinates are valid (not null and not 0.0,0.0)
// Treats (0,0) as invalid since it's in the Gulf of Guinea and not a real user location
function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) {
    return false;
  }
  // Treat (0,0) as invalid - it's not a real user location
  const epsilon = 0.0001;
  if (Math.abs(lat) < epsilon && Math.abs(lng) < epsilon) {
    return false;
  }
  return true;
}

type PromptAnswer = {
  question: string;
  answer: string;
};

type Recommendation = {
  id: number;
  name: string | null;
  profilePicture: string | null;
  age?: number | null;
  location?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  gender?: string | null;
  lookingFor?: string | null;
  interests: string[];
  prompts: PromptAnswer[];
  distanceKm?: number | null;
};

type ProfileCompletion = {
  percent: number; // 0, 80, 100
  hasBasics: boolean;
  hasPhoto: boolean;
  hasPrompts: boolean;
  hasInterests: boolean;
};

export default function Discovery() {
  const { user, logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

  // unread count from matches
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadUnreadCounts() {
      try {
        const data: any = await api.matches.getMyMatches();
        if (!alive) return;

        let total = 0;
        (data.matches || []).forEach((m: any) => {
          if (typeof m.unreadCount === "number") total += m.unreadCount;
        });
        setNotifCount(total);
      } catch {
        // ignore
      }
    }

    if (isAuthenticated) {
      loadUnreadCounts();
      const interval = setInterval(loadUnreadCounts, 5000);
      return () => {
        alive = false;
        clearInterval(interval);
      };
    }

    setNotifCount(0);
    return undefined;
  }, [isAuthenticated]);

  useEffect(() => {
    loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const myProfile: any = await api.profile.getMyProfile();
      const myBio: any = await api.profile.getMyBio();
      const myPhotos: any = await api.photos.getMyPhotos();

      // ✅ current working behavior: backend returns array of ids like [3,1]
      const ids: number[] = await api.discovery.getRecommendations();

      // --- PHOTOS (robust: handles all API shapes) ---
const photosArray =
  myPhotos?.photos ||
  myPhotos?.data?.photos ||
  (Array.isArray(myPhotos) ? myPhotos : []);

        const hasPhoto = Array.isArray(photosArray) && photosArray.length > 0;

        // --- PROFILE BASICS ---
        const hasBasics = Boolean(
          myProfile?.firstName &&
          myProfile?.age &&
          myProfile?.gender &&
          myProfile?.location &&
          myProfile?.bio
        );

        // --- BIO (prompts + interests) ---
        const bioObj = myBio?.data ? myBio.data : (myBio || {});

        const hasPrompts = (bioObj.prompts || []).length >= 3;
        const hasInterests = (bioObj.interests || []).length >= 3;


      let percent = 0;
      if (hasBasics && hasPhoto) percent = 80;
      if (percent === 80 && hasPrompts && hasInterests) percent = 100;

      setCompletion({
        percent,
        hasBasics,
        hasPhoto,
        hasPrompts,
        hasInterests,
      });

      if (!ids.length) {
        setRecommendations([]);
        return;
      }

      const cards: Recommendation[] = [];

      // keep it simple (works + avoids Promise.all exploding on one bad user)
      for (const id of ids) {
        try {
          const userData: any = await api.users.getUser(id);
          const profile: any = await api.users.getProfile(id);
          const bio: any = await api.users.getBio(id);

          let dist: number | null = null;
          if (
            isValidCoordinate(myProfile?.latitude ?? null, myProfile?.longitude ?? null) &&
            isValidCoordinate(profile?.latitude ?? null, profile?.longitude ?? null)
          ) {
            dist = distanceKm(
              myProfile.latitude!,
              myProfile.longitude!,
              profile.latitude!,
              profile.longitude!
            );
          }

          cards.push({
            id,
            name: userData?.name ?? null,
            profilePicture: userData?.profilePicture ?? null,
            age: profile?.age ?? null,
            location: profile?.location ?? null,
            bio: profile?.bio ?? "",
            isVerified: profile?.isVerified ?? false,
            gender: profile?.gender ?? null,
            lookingFor: profile?.lookingFor ?? null,
            interests: bio?.interests || [],
            prompts: bio?.prompts || [],
            distanceKm: dist,
          });
        } catch (e) {
          console.error("Skipping user", id, e);
        }
      }

      setRecommendations(cards);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: number) => {
    try {
      await api.discovery.interact(id, "like");
      toast.success("Liked!");
      setRecommendations((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to like");
    }
  };

  const handlePass = async (id: number) => {
    try {
      await api.discovery.interact(id, "pass");
      setRecommendations((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to pass");
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const goToPromptsAndInterests = () => {
    setLocation("/onboarding?step=2");
  };

  if (loading && !completion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const profileIsIncomplete = Boolean(completion && completion.percent < 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with navigation icons (old look) */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Discovery</h1>
            {user && (
              <p className="text-sm text-gray-500">
                Logged in as {user.name || user.email}
              </p>
            )}
            {completion && (
              <p className="mt-2 text-sm text-gray-600">
                Profile completion:{" "}
                <span className="font-semibold">{completion.percent}%</span>
              </p>
            )}
          </div>

          <nav className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} aria-label="Go to home">
              <Home className="h-5 w-5" />
            </Button>

            <Button variant="ghost" onClick={() => setLocation("/me")}>
              My Profile
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/me?tab=chats")}
                aria-label="Open chats"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>

              {notifCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 px-1 py-0 text-[10px]"
                >
                  {notifCount}
                </Badge>
              )}
            </div>

            <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>
        </header>

        {/* ✅ PROFILE COMPLETION GATE (old look) */}
        {completion && profileIsIncomplete && (
          <Card className="p-6 sm:p-8 space-y-4 mb-6">
            <h2 className="text-xl font-semibold">Complete your profile to start discovering</h2>

            <p className="text-sm text-gray-600">
              Your profile is{" "}
              <span className="font-semibold">{completion.percent}%</span>{" "}
              complete.
            </p>

            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {!completion.hasBasics && (
                <li>Fill in your basic info: name, age, gender, location, and a short bio.</li>
              )}
              {!completion.hasPhoto && <li>Add at least one profile photo.</li>}

              {!completion.hasPrompts && (
                <li>
                  <button
                    type="button"
                    className="underline text-rose-600"
                    onClick={goToPromptsAndInterests}
                  >
                    Answer at least 3 conversation prompts.
                  </button>
                </li>
              )}

              {!completion.hasInterests && (
                <li>
                  <button
                    type="button"
                    className="underline text-rose-600"
                    onClick={goToPromptsAndInterests}
                  >
                    Select at least 3 interests.
                  </button>
                </li>
              )}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setLocation("/edit-profile")}>Edit profile</Button>
              <Button variant="outline" onClick={() => setLocation("/me")}>Go to profile hub</Button>
              <Button variant="outline" onClick={goToPromptsAndInterests}>Manage prompts & interests</Button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Once you reach 100%, your recommendations will appear here.
            </p>
          </Card>
        )}

        {/* RECOMMENDATIONS LIST – only when 100% complete (old look) */}
        {!profileIsIncomplete && (
          <>
            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-gray-600">Loading recommendations…</p>
              </Card>
            ) : recommendations.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="mb-4">No more recommendations at the moment.</p>
                <Button onClick={loadRecommendations} disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec) => (
                  <Card key={rec.id} className="p-6 flex flex-col gap-4">
                    {/* top row */}
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14">
                        {rec.profilePicture ? (
                          <AvatarImage src={rec.profilePicture} alt={rec.name || `User ${rec.id}`} />
                        ) : (
                          <AvatarFallback>
                            {(rec.name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold">
                            {rec.name || "Anonymous"}
                            {rec.age ? `, ${rec.age}` : ""}
                          </h2>
                          {rec.isVerified && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
                          {rec.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {rec.location}
                            </span>
                          )}
                          {rec.gender && <span>{rec.gender}</span>}
                          {rec.lookingFor && (
                            <span className="inline-flex items-center gap-1">
                              <HeartHandshake className="h-3 w-3" />
                              Looking for {rec.lookingFor}
                            </span>
                          )}
                        </div>

                        {rec.distanceKm != null ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            {rec.distanceKm.toFixed(1)} km away
                          </p>
                        ) : rec.location && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Distance unavailable
                          </p>
                        )}

                        {rec.bio && (
                          <p className="mt-3 text-sm text-gray-700">{rec.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* interests */}
                    {rec.interests?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {rec.interests.slice(0, 8).map((interest) => (
                          <Badge key={interest} variant="secondary" className="text-xs">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* prompts */}
                    {rec.prompts?.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {rec.prompts.slice(0, 2).map((p, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium text-gray-700">{p.question}</p>
                            <p className="text-gray-600">{p.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* actions */}
                    <div className="mt-4 flex gap-3">
                      <Button onClick={() => handlePass(rec.id)} variant="outline" className="flex-1">
                        Pass
                      </Button>
                      <Button onClick={() => handleLike(rec.id)} className="flex-1">
                        Like
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
