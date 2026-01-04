import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { COUNTRIES_EUROPE } from "@/data/COUNTRIES_EUROPE";

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

type Photo = {
  id: number;
  photoUrl: string;
  displayOrder: number;
};

export default function EditProfile() {
  const { user, logout, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentUserFromBackend, setCurrentUserFromBackend] = useState<any>(null);
  const [fetchingUser, setFetchingUser] = useState(true);

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
    maxDistanceKm: "",
    allowOutsideRadius: false,
  });

  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });

  const [photos, setPhotos] = useState<Photo[]>([]);

  const profilePhoto = photos[0] ?? null;
  const hasProfilePhoto = !!profilePhoto;

  useEffect(() => {
    // Always fetch current user from Go backend to ensure we have the correct user
    // This prevents deleting the wrong user due to stale auth state
    const fetchCurrentUser = async () => {
      try {
        setFetchingUser(true);
        const GO_BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
        const res = await fetch(`${GO_BACKEND_URL}/api/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Important: include cookies for auth
        });

        if (!res.ok) {
          if (res.status === 401) {
            // Not authenticated, redirect to login
            setLocation("/login");
            return;
          }
          throw new Error("Failed to fetch current user");
        }

        const userData = await res.json();
        setCurrentUserFromBackend(userData);
      } catch (error) {
        console.error("Error fetching current user from backend:", error);
        toast.error("Failed to verify your account. Please refresh the page.");
      } finally {
        setFetchingUser(false);
      }
    };

    fetchCurrentUser();
    loadProfile();
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const splitLocation = (location?: string | null) => {
    if (!location) return { city: "", country: "" };
    const parts = location.split(",").map((p) => p.trim());
    if (parts.length === 1) {
      return { city: parts[0], country: "" };
    }
    return {
      city: parts[0],
      country: parts[parts.length - 1],
    };
  };

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
          msg = "Location is unavailable. Check that location services are enabled.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Try again.";
        }

        toast.error(msg);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000,
      }
    );
  };

  const loadProfile = async () => {
    try {
      const data: any = await api.profile.getMyProfile();
      const { city, country } = splitLocation(data.location);

      setFormData({
        firstName: data.firstName || "",
        age: data.age?.toString() || "",
        minAge: data.minAge?.toString() || "",
        maxAge: data.maxAge?.toString() || "",
        gender: data.gender || "",
        lookingFor: data.lookingFor || "",
        city,
        country,
        bio: data.bio || "",
        maxDistanceKm:
          data.maxDistanceKm != null ? String(data.maxDistanceKm) : "",
        allowOutsideRadius: data.allowOutsideRadius ?? false,
      });

      setCoords({
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadPhotos = async () => {
    try {
      const data: any = await api.photos.getMyPhotos();
      setPhotos(data || []);
    } catch (error) {
      console.error("Failed to load photos", error);
    }
  };

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

          // 👉 Use existing API: addPhoto(url: string)
          // For now we send the data URL; backend will store it as photoUrl.
          await api.photos.addPhoto(result);

          await loadPhotos();
          toast.success("Profile photo uploaded");
        } catch (err: any) {
          console.error(err);
          toast.error(err.message || "Failed to upload photo");
        }
      };
      reader.readAsDataURL(file);
    };


  const handleDeletePhoto = async () => {
    if (!profilePhoto) return;

    try {
      await api.photos.deletePhoto(profilePhoto.id);
      await loadPhotos();
      toast.success("Profile photo removed");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove photo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Enforce mandatory profile picture
    if (!hasProfilePhoto) {
      toast.error("Please add a profile photo before saving your profile.");
      return;
    }

    // Validate age range if both provided
    if (formData.minAge && formData.maxAge) {
      const min = parseInt(formData.minAge, 10);
      const max = parseInt(formData.maxAge, 10);
      if (min > max) {
        toast.error("Min age must be less than or equal to max age");
        return;
      }
    }

    setLoading(true);

    try {
      await api.profile.updateProfile({
        firstName: formData.firstName,
        age: parseInt(formData.age, 10),
        minAge: formData.minAge ? parseInt(formData.minAge, 10) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge, 10) : null,
        gender: formData.gender,
        lookingFor: formData.lookingFor,
        location: buildLocationString(),
        bio: formData.bio,
        latitude: coords.latitude,
        longitude: coords.longitude,
        maxDistanceKm: formData.maxDistanceKm
          ? parseInt(formData.maxDistanceKm, 10)
          : null,
        allowOutsideRadius: formData.allowOutsideRadius,
      });

      toast.success("Profile updated!");
      setLocation("/discovery");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

    const handleDeleteAccount = async () => {
    // Double-check: ensure we have the current user from backend
    if (!currentUserFromBackend) {
      toast.error("Please wait while we verify your account...");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete your account (${currentUserFromBackend.email})? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      setDeleteLoading(true);
      const GO_BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
      const res = await fetch(`${GO_BACKEND_URL}/api/me`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: include cookies for auth
      });

      if (!res.ok) {
        let message = "Failed to delete account";
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // ignore JSON parse errors
        }
        toast.error(message);
        return;
      }

      toast.success("Your account has been deleted.");
      
      // Close WebSocket connection explicitly
      try {
        const { ws } = await import("@/lib/websocket");
        ws.disconnect();
      } catch {
        // Ignore if WebSocket module fails to load
      }

      // Clear user state by calling logout
      try {
        await logout();
      } catch {
        // Ignore logout errors
      }

      // Clear local state
      setCurrentUserFromBackend(null);

      // After deletion, send user to home/login page
      setLocation("/");
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };


  const profileInitial =
    formData.firstName?.charAt(0).toUpperCase() ||
    user?.name?.charAt(0).toUpperCase() ||
    "?";

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>

          {/* Profile photo section */}
          <div className="mb-6 flex items-center gap-4">
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

              {profilePhoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeletePhoto}
                >
                  Remove photo
                </Button>
              )}

              {!profilePhoto && (
                <p className="text-xs text-red-500">
                  You must add at least one photo to complete your profile.
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Email (owner only – read-only) */}
            {user?.email && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email address cannot be changed
              </p>
            </div>
          )}

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
                  placeholder="e.g. Berlin"
                  required
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

            {/* Distance + use device location */}
            <div className="mt-4 space-y-4">
              {/* Max distance */}
              <div className="max-w-sm">
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

              {/* Allow outside radius toggle */}
              <div className="max-w-sm flex items-center gap-3">
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
              <p className="text-xs text-muted-foreground max-w-sm">
                Enable this to see recommendations outside your selected radius
                if there aren't enough matches nearby.
              </p>

              {/* Use device location */}
              <div className="max-w-sm flex flex-col gap-2">
                <Label>Use device location</Label>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={handleUseCurrentLocation}
                  >
                    Use my current location
                  </Button>
                </div>

                {coords.latitude && coords.longitude && 
                 !(Math.abs(coords.latitude) < 0.0001 && Math.abs(coords.longitude) < 0.0001) ? (
                  <p className="text-xs text-muted-foreground break-words">
                    Saved: {coords.latitude.toFixed(3)},{" "}
                    {coords.longitude.toFixed(3)}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">
                    Set your location to enable nearby matches
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/discovery")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
                        {/* Manage prompts & interests */}
            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-gray-500 mb-2">
                Conversation prompts & interests
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/onboarding?step=2")}
              >
                Manage prompts & interests
              </Button>
            </div>         
          </form>
          {/* Danger zone: delete account */}
            <div className="mt-10 border-t pt-6">
              <h2 className="text-sm font-semibold text-red-600 mb-2">
                Danger zone
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Deleting your account is permanent. Your profile, matches, and
                messages will be removed and cannot be restored.
              </p>
              {fetchingUser && (
                <p className="text-xs text-muted-foreground mb-2">
                  Verifying your account...
                </p>
              )}
              {currentUserFromBackend && (
                <p className="text-xs text-muted-foreground mb-2">
                  Account: {currentUserFromBackend.email}
                </p>
              )}
              {!fetchingUser && !currentUserFromBackend && (
                <p className="text-xs text-red-500 mb-2">
                  Unable to verify your account. Please refresh the page.
                </p>
              )}
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || fetchingUser || !currentUserFromBackend}
              >
                {deleteLoading ? "Deleting..." : "Delete my account"}
              </Button>
            </div>
        </Card>
      </div>
    </div>
  );
}
