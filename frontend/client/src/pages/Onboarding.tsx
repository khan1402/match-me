import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { COUNTRIES_EUROPE } from "@/data/COUNTRIES_EUROPE";

type Prompt = {
  id: number;
  text: string;
  category?: string | null;
};

type Interest = {
  id: number;
  name: string;
  category: string;
};

type Photo = {
  id: number;
  photoUrl: string;
  displayOrder: number;
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const LOOKING_FOR_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "non-binary", label: "Non-binary people" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(() => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    if (stepParam === "2") {
      return 2; // start directly on prompts & interests
    }
  }
  return 1; // default for normal onboarding flow
});

// ✅ Coming from "Manage prompts & interests"?
  const managePromptsOnly =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("step") === "2";

  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    age: "",
    minAge: "",
    maxAge: "",
    gender: "",
    lookingFor: "",
    city: "",
    country: "",
    bio: "",
    maxDistanceKm: "50",
    allowOutsideRadius: false,
  });

  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });

  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [allInterests, setAllInterests] = useState<Interest[]>([]);

  const [selectedPrompts, setSelectedPrompts] = useState<Record<number, string>>(
    {}
  );
  const selectedPromptCount = Object.keys(selectedPrompts).length;
  
  const [originalPromptIds, setOriginalPromptIds] = useState<number[]>([]);

  const [selectedInterestIds, setSelectedInterestIds] = useState<number[]>([]);

  // Photos state for onboarding
  const [photos, setPhotos] = useState<Photo[]>([]);
  const profilePhoto = photos[0] ?? null;
  const hasProfilePhoto = !!profilePhoto;

  const profileInitial =
    formData.firstName?.charAt(0).toUpperCase() ||
    user?.name?.charAt(0).toUpperCase() ||
    "?";

  // Prefill firstName from user.name once (to reduce name mismatch)
  useEffect(() => {
    if (user?.name && !formData.firstName) {
      setFormData((prev) => ({ ...prev, firstName: user.name || "" }));
    }
  }, [user, formData.firstName]);

  // Load prompts, interests and existing photos (if any)
    // Load prompts, interests and existing photos (if any)
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [promptsRes, interestsRes, myBioRes] = await Promise.all([
          api.prompts.getAll() as any,
          api.interests.getAll() as any,
          // may fail if user has no bio yet → treat as "no data"
          api.profile.getMyBio().catch(() => null) as any,
        ]);

        const promptsList: Prompt[] = promptsRes.prompts || [];
        const interestsList: Interest[] = interestsRes.interests || [];

        setAllPrompts(promptsList);
        setAllInterests(interestsList);

        // 🔁 Prefill from existing choices, if any
        if (myBioRes) {
          const bio = myBioRes || {};
          const existingPrompts = Array.isArray(bio.prompts)
            ? bio.prompts
            : [];
          const existingInterests = Array.isArray(bio.interests)
            ? bio.interests
            : [];

          // ---- 1) Prefill selected prompts ----
          if (existingPrompts.length > 0) {
            const initialSelectedPrompts: Record<number, string> = {};

            existingPrompts.forEach((p: any) => {
              // Discovery uses { question, answer }
              const match = promptsList.find(
                (prompt) => prompt.text === p.question
              );
              if (match) {
                initialSelectedPrompts[match.id] = p.answer || "";
              }
            });

            if (Object.keys(initialSelectedPrompts).length > 0) {
              setSelectedPrompts(initialSelectedPrompts);
              setOriginalPromptIds(Object.keys(initialSelectedPrompts).map(Number)); 
            }
          }

          // ---- 2) Prefill selected interests ----
          if (existingInterests.length > 0) {
            const interestNameSet = new Set(
              existingInterests.map((name: string) =>
                name.toLowerCase()
              )
            );

            const matchedIds = interestsList
              .filter((interest) =>
                interestNameSet.has(interest.name.toLowerCase())
              )
              .map((interest) => interest.id);

            if (matchedIds.length > 0) {
              setSelectedInterestIds(matchedIds);
            }
          }
        }
      } catch (error) {
        console.error(error);
        toast.error("Couldn't load prompts and interests");
      }
    };

    const loadPhotos = async () => {
      try {
        const data: any = await api.photos.getMyPhotos();
        const list = Array.isArray(data) ? data : data.photos || [];
        setPhotos(list);
      } catch (err) {
        console.error("Failed to load photos during onboarding", err);
      }
    };

    loadMeta();
    loadPhotos();
  }, []);

  // Helpers
  const buildLocationString = () => {
    const { city, country } = formData;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return "";
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        toast.success("Location captured from your device");
      },
      (err) => {
        console.error("Geolocation error", err);

        let msg = "Couldn't get your location.";
        if (err.code === 1) {
          msg = "Location permission was denied in browser/OS settings.";
        } else if (err.code === 2) {
          msg =
            "We couldn't get a precise device location. You can continue using your city and country normally.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Try again.";
        }

        toast.error(msg);
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: Infinity,
      }
    );
  };

  // Upload photo (same logic as EditProfile)
  const handlePhotoChange = async (e: any) => {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const result = reader.result as string;
        await api.photos.addPhoto(result);

        // Re-fetch photos so hasProfilePhoto becomes true
        const data: any = await api.photos.getMyPhotos();
        const list = Array.isArray(data) ? data : data.photos || [];
        setPhotos(list);

        toast.success("Profile photo uploaded");
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to upload photo");
      }
    };
    reader.readAsDataURL(file);
  };

  // STEP 1 → basic validation + mandatory photo
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.age || !formData.gender) {
      toast.error("Please fill at least name, age and gender.");
      return;
    }

    if (!hasProfilePhoto) {
      toast.error("Please add a profile photo to continue.");
      return;
    }

    setStep(2);
  };

  // Final submit: profile + prompts + interests
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1) Save main profile (only in normal onboarding, not in manage-prompts mode)
    if (!managePromptsOnly) {
      // Validate age range if both provided
      if (formData.minAge && formData.maxAge) {
        const min = parseInt(formData.minAge, 10);
        const max = parseInt(formData.maxAge, 10);
        if (min > max) {
          toast.error("Min age must be less than or equal to max age");
          return;
        }
      }

      await api.profile.updateProfile({
        firstName: formData.firstName,
        age: formData.age ? parseInt(formData.age, 10) : null,
        minAge: formData.minAge ? parseInt(formData.minAge, 10) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge, 10) : null,
        gender: formData.gender || null,
        lookingFor: formData.lookingFor || null,
        location: buildLocationString(),
        bio: formData.bio,
        latitude: coords.latitude,
        longitude: coords.longitude,
        maxDistanceKm: formData.maxDistanceKm
          ? parseInt(formData.maxDistanceKm, 10)
          : null,
        allowOutsideRadius: formData.allowOutsideRadius,
      });
    }

    // Delete prompts that were removed
    const currentPromptIds = Object.keys(selectedPrompts).map(Number);
    const removedPromptIds = originalPromptIds.filter(
      (id) => !currentPromptIds.includes(id)
    );

    if (removedPromptIds.length > 0) {
      await Promise.all(
        removedPromptIds.map((promptId) =>
          fetch(`/api/me/prompts/${promptId}`, {
            method: "DELETE",
            credentials: "include",
          })
        )
      );
    }
    // 2) Build answered prompts (now completely optional)
    const promptEntries = Object.entries(selectedPrompts)
      .map(([id, answer]) => ({
        promptId: Number(id),
        answer: answer.trim(),
      }))
      .filter((p) => p.answer.length > 0);

    // No more "at least 3" rule – we just respect whatever the user filled.
    // UI already prevents selecting more than 5.

    if (promptEntries.length > 0) {
      await Promise.all(
        promptEntries.map((p, index) =>
          api.prompts.addPrompt(p.promptId, p.answer, index + 1)
        )
      );
    }

    // 3) Save interests (also optional)
    if (selectedInterestIds.length > 0) {
      await Promise.all(
        selectedInterestIds.map((id) => api.interests.addInterest(id))
      );
    }

    toast.success(
      managePromptsOnly
        ? "Prompts & interests updated!"
        : "Profile created!"
    );

    setLocation("/discovery");
  } catch (error: any) {
    console.error(error);
    toast.error(error.message || "Failed to save changes");
  } finally {
    setLoading(false);
  }
};


  const togglePrompt = (promptId: number) => {
    setSelectedPrompts((prev) => {
      const copy = { ...prev };

      if (copy[promptId] !== undefined) {
        delete copy[promptId];
        return copy;
      }

      const currentCount = Object.keys(copy).length;
      if (currentCount >= 5) {
        toast.error("You can only select up to 5 prompts");
        return copy;
      }

      copy[promptId] = "";
      return copy;
    });
  };

  const updatePromptAnswer = (promptId: number, value: string) => {
    setSelectedPrompts((prev) => ({ ...prev, [promptId]: value }));
  };

  const toggleInterest = (interestId: number) => {
    setSelectedInterestIds((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId]
    );
  };

  const interestsByCategory = allInterests.reduce<Record<string, Interest[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>
            {step === 1 ? "Create Your Profile" : "Add Prompts & Interests"}
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Step {step} of 2</p>
        </CardHeader>

        <CardContent>
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              {/* Profile photo section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {profilePhoto ? (
                    <AvatarImage
                      src={profilePhoto.photoUrl}
                      alt="Profile photo"
                    />
                  ) : (
                    <AvatarFallback>{profileInitial}</AvatarFallback>
                  )}
                </Avatar>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor="profilePhoto">Profile photo</Label>
                    <Input
                      id="profilePhoto"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  {!profilePhoto && (
                    <p className="text-xs text-red-500">
                      You must add a photo to complete your profile.
                    </p>
                  )}
                </div>
              </div>

              {/* Basic profile fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min={18}
                    value={formData.age}
                    onChange={(e) =>
                      setFormData({ ...formData, age: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Optional age range preferences */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minAge">Min Preferred Age (Optional)</Label>
                  <Input
                    id="minAge"
                    type="number"
                    min={18}
                    max={99}
                    value={formData.minAge}
                    onChange={(e) =>
                      setFormData({ ...formData, minAge: e.target.value })
                    }
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <Label htmlFor="maxAge">Max Preferred Age (Optional)</Label>
                  <Input
                    id="maxAge"
                    type="number"
                    min={18}
                    max={99}
                    value={formData.maxAge}
                    onChange={(e) =>
                      setFormData({ ...formData, maxAge: e.target.value })
                    }
                    placeholder="e.g. 35"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select your gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="lookingFor">Looking For</Label>
                  <Select
                    value={formData.lookingFor}
                    onValueChange={(value) =>
                      setFormData({ ...formData, lookingFor: value })
                    }
                  >
                    <SelectTrigger id="lookingFor">
                      <SelectValue placeholder="Who are you interested in?" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOOKING_FOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="e.g. Helsinki"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) =>
                      setFormData({ ...formData, country: value })
                    }
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES_EUROPE.map((country: string) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxDistanceKm">Maximum distance (km)</Label>
                  <Input
                    id="maxDistanceKm"
                    type="number"
                    min={1}
                    max={500}
                    value={formData.maxDistanceKm}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxDistanceKm: e.target.value,
                      })
                    }
                    placeholder="e.g. 50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll recommend people within this radius when your GPS is
                    available.
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-w-0">
                  <Label>Use device location</Label>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap"
                      onClick={handleUseCurrentLocation}
                    >
                      Use my current location
                    </Button>
                  </div>

                  {coords.latitude && coords.longitude && (
                    <p className="text-xs text-muted-foreground break-words">
                      Saved: {coords.latitude.toFixed(3)},{" "}
                      {coords.longitude.toFixed(3)}
                    </p>
                  )}
                </div>
              </div>

              {/* Allow outside radius toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="allowOutsideRadius"
                  checked={formData.allowOutsideRadius}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      allowOutsideRadius: checked,
                    })
                  }
                />
                <Label htmlFor="allowOutsideRadius" className="cursor-pointer">
                  Show people outside my distance (optional)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable this to see recommendations outside your selected radius
                if there aren't enough matches nearby.
              </p>

              <div>
                <Label htmlFor="bio">Short Bio</Label>
                <Input
                  id="bio"
                  placeholder="Tell people a little about you"
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit">Next: Prompts & Interests</Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Prompts */}
              <section>
                <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-lg">Conversation prompts</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Optional – add up to 5 prompts</span>
                  <span className="text-[10px] text-gray-400">
                    Selected: {selectedPromptCount} / 5
                  </span>
                </div>
              </div>


                {allPrompts.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No prompts configured in the database.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {allPrompts.map((prompt) => {
                      const selected =
                        selectedPrompts[prompt.id] !== undefined;
                      return (
                        <div
                          key={prompt.id}
                          className={`rounded-lg border p-3 space-y-2 ${
                            selected ? "border-rose-300 bg-rose-50/60" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">
                                {prompt.text}
                              </p>
                              {prompt.category && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-xs"
                                >
                                  {prompt.category}
                                </Badge>
                              )}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant={selected ? "outline" : "ghost"}
                              onClick={() => togglePrompt(prompt.id)}
                            >
                              {selected ? "Remove" : "Answer"}
                            </Button>
                          </div>

                          {selected && (
                            <Textarea
                              rows={2}
                              placeholder="Write your answer..."
                              value={selectedPrompts[prompt.id] || ""}
                              onChange={(e) =>
                                updatePromptAnswer(prompt.id, e.target.value)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Interests */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-lg">Your interests</h2>
                  <span className="text-xs text-gray-500">
                    Choose a few things you care about.
                  </span>
                </div>

                {allInterests.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No interests configured in the database.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                    {Object.entries(interestsByCategory).map(
                      ([category, items]) => (
                        <div key={category}>
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                            {category}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {items.map((interest) => {
                              const selected = selectedInterestIds.includes(
                                interest.id
                              );
                              return (
                                <Button
                                  key={interest.id}
                                  type="button"
                                  size="sm"
                                  variant={selected ? "default" : "outline"}
                                  className="rounded-full text-xs"
                                  onClick={() => toggleInterest(interest.id)}
                                >
                                  {interest.name}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading} className="min-w-32">
                  {loading ? "Saving..." : "Finish & Start Discovering"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
