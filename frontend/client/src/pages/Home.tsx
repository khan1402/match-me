import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Heart, Sparkles, MessageCircle, Compass } from "lucide-react";
import api from "@/lib/api";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Unread message notification count.  We poll the notifications
  // endpoint periodically when the user is authenticated to update
  // this count so we can show a badge on the chat icon.  We exclude
  // typing indicators from the count.
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    // Poll the current user's matches and sum up the unread message
    // counts across all matches.  This provides a robust way to
    // determine how many unread chat messages exist without relying
    // solely on the notifications table, which may not be present in
    // all versions of the backend.  When the user is not
    // authenticated, the count resets to 0.
    let isMounted = true;
    async function loadUnreadCounts() {
      try {
        const data: any = await api.matches.getMyMatches();
        if (!isMounted) return;
        let total = 0;
        (data.matches || []).forEach((m: any) => {
          if (m.unreadCount && typeof m.unreadCount === "number") {
            total += m.unreadCount;
          }
        });
        setNotifCount(total);
      } catch (err) {
        console.error(err);
      }
    }
    if (isAuthenticated) {
      loadUnreadCounts();
      const interval = setInterval(loadUnreadCounts, 5000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
    // If unauthenticated, reset notif count
    setNotifCount(0);
    return undefined;
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <header className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              Match-Me
            </span>
          </div>

          {/* RIGHT SIDE BUTTONS */}
          <div className="flex gap-3 items-center">
            {isAuthenticated ? (
              <>
                {/* Logged-in view */}
                <span className="hidden sm:inline text-sm text-gray-600">
                  Logged in as {user?.name || user?.email}
                </span>

                {/* My Profile (Profile Hub at /me) */}
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/me")}
                >
                  My Profile
                </Button>

            {/* Chat / Notifications button – shows unread chat count */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                // When clicking the chat icon, navigate directly to the
                // profile hub with the chats tab selected via query param.
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

                {/* Discovery icon */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/discovery")}
                  className="rounded-full"
                  aria-label="Go to Discovery"
                >
                  <Compass className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                {/* Logged-out view */}
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/login")}
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => setLocation("/register")}
                  className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg">
              <Heart className="w-10 h-10 text-white fill-white" />
            </div>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            Match-Me Dating App
          </h1>
          <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
            Designed to be deleted
          </p>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto">
            Connect with people who share your interests and values. No mindless
            swiping— just meaningful conversations based on what makes you, you.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Prompt-Based Profiles</h3>
            <p className="text-gray-600">
              Show your personality through thoughtful prompts instead of just
              photos.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <Heart className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Meaningful Matches</h3>
            <p className="text-gray-600">
              Connect based on shared interests, values, and compatibility.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Start Conversations</h3>
            <p className="text-gray-600">
              Comment on specific prompts to break the ice naturally.
            </p>
          </div>
        </div>

                {/* CTA */}
        {isAuthenticated ? (
          // Logged-in home
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">
              Welcome back{user?.name ? `, ${user.name}` : ""} 👋
            </h2>
            <p className="text-gray-600 mb-8">
              Jump back into discovery and meet new people who match your
              interests and values.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => setLocation("/discovery")}
                className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-lg px-8 py-6"
              >
                Go to Discovery
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/me")}
                className="text-lg px-8 py-6"
              >
                View My Profile
              </Button>
            </div>
          </div>
        ) : (
          // Visitor / logged-out home
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to find your match?</h2>
            <p className="text-gray-600 mb-8">
              Join thousands of people making meaningful connections every day.
            </p>
            <Button
              size="lg"
              onClick={() => setLocation("/register")}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-lg px-8 py-6"
            >
              Create Your Profile
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 Match-Me Dating App. Designed to be deleted.
          </p>
        </div>
      </footer>
    </div>
  );
}