import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId ? parseInt(params.userId) : 0;
  
  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      // Fetch both profile and bio data
      const [profileData, bioData] = await Promise.all([
        api.users.getProfile(userId),
        api.users.getBio(userId),
      ]);
      
      setProfile(profileData);
      setBio(bioData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!profile) return <div className="p-8">Profile not found</div>;

  const hasInterests = bio?.interests && bio.interests.length > 0;
  const hasPrompts = bio?.prompts && bio.prompts.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Basic Info Card */}
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-4">{profile.firstName}</h1>
          <p className="text-gray-600 mb-2">Age: {profile.age}</p>
          <p className="text-gray-600 mb-2">Location: {profile.location}</p>
          {profile.bio && <p className="mt-4">{profile.bio}</p>}
        </Card>

        {/* Interests Card - Only show if they have interests */}
        {hasInterests && (
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-4">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {bio.interests.map((interest: string, index: number) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-sm"
                >
                  {interest}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Prompts Card - Only show if they have prompts */}
        {hasPrompts && (
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-4">About Me</h2>
            <div className="space-y-4">
              {bio.prompts.map((prompt: any, index: number) => (
                <div key={index}>
                  <p className="font-medium text-gray-700">{prompt.question}</p>
                  <p className="text-gray-600 mt-1">{prompt.answer}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Message when no detailed info is available */}
        {!hasInterests && !hasPrompts && (
          <Card className="p-8 text-center text-gray-500">
            <p>Connect with this user to see more details!</p>
          </Card>
        )}
      </div>
    </div>
  );
}