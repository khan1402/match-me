import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId ? parseInt(params.userId) : 0;
  
  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      // Fetch user data (for profilePicture), profile, and bio data
      const [userDataRes, profileData, bioData] = await Promise.all([
        api.users.getUser(userId).catch(() => null),
        api.users.getProfile(userId),
        api.users.getBio(userId),
      ]);
      
      // ✅ CRITICAL: Validate all fetched data belongs to the correct userId
      if (userDataRes && userDataRes.id !== userId) {
        console.error(`[Profile] CRITICAL ID MISMATCH: Expected userId=${userId}, got userData.id=${userDataRes.id} - REJECTING userData`);
        setUserData(null);
      } else {
        setUserData(userDataRes);
      }
      
      if (profileData && profileData.id !== userId) {
        console.error(`[Profile] CRITICAL ID MISMATCH: Expected userId=${userId}, got profile.id=${profileData.id} - REJECTING profile`);
        setProfile(null);
      } else {
        setProfile(profileData);
      }
      
      if (bioData && bioData.id !== userId) {
        console.error(`[Profile] CRITICAL ID MISMATCH: Expected userId=${userId}, got bio.id=${bioData.id} - REJECTING bio`);
        setBio(null);
      } else {
        setBio(bioData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Profile not found</p>
        </div>
      </div>
    );
  }

  const hasInterests = bio?.interests && bio.interests.length > 0;
  const hasPrompts = bio?.prompts && bio.prompts.length > 0;
  
  // Get profile picture from userData or profile
  const profilePicture = userData?.profilePicture || profile?.profilePicture || null;
  const displayName = profile.firstName || userData?.name || "Anonymous";
  
  // Build compact info row
  const infoItems = [
    profile.age && `${profile.age}`,
    profile.location,
    profile.gender && profile.lookingFor 
      ? `${profile.gender} • Looking for ${profile.lookingFor}`
      : profile.gender || profile.lookingFor,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card className="border-rose-100 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              {/* Profile Picture */}
              <div className="relative flex-shrink-0">
                <Avatar className="h-32 w-32 sm:h-40 sm:w-40 border-4 border-white shadow-lg">
                  <AvatarImage src={profilePicture} alt={displayName} />
                  <AvatarFallback className="text-3xl sm:text-4xl bg-gradient-to-br from-rose-400 to-pink-500 text-white">
                    {displayName
                      .split(" ")
                      .map((p: string) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {profile.isVerified && (
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                  </div>
                )}
              </div>

              {/* Name and Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                    {displayName}
                  </h1>
                  {profile.isVerified && (
                    <Badge variant="secondary" className="text-xs px-2 py-1">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>

                {/* Compact Info Row */}
                {infoItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    {infoItems.map((item, idx) => (
                      <span key={idx}>
                        {item}
                        {idx < infoItems.length - 1 && (
                          <span className="mx-2 text-gray-400">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Interests Section */}
        {hasInterests && (
          <Card className="border-rose-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {bio.interests.map((interest: string, index: number) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1.5 text-sm bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* About Me / Prompts Section */}
        {hasPrompts && (
          <Card className="border-rose-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">About Me</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bio.prompts.map((prompt: any, index: number) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-gradient-to-br from-rose-50/50 to-pink-50/50 border border-rose-100"
                >
                  <p className="text-sm font-semibold text-rose-900 mb-2">
                    {prompt.question}
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    {prompt.answer || (
                      <span className="text-gray-400 italic">No answer yet</span>
                    )}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Bio Section (if exists and not in prompts) */}
        {profile.bio && (
          <Card className="border-rose-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Bio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!hasInterests && !hasPrompts && !profile.bio && (
          <Card className="border-rose-100">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">
                This profile doesn&apos;t have any additional details yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}