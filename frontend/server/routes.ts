import { Router, Request, Response } from "express";
import * as db from "./db";
import { verifyToken } from "./auth";
// Import real‑time helpers to push events to connected clients
import { emitMessage, emitTyping } from "./socket";

const router = Router();

// Middleware to extract user from JWT
async function authenticateUser(req: Request, res: Response, next: Function) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user = await db.getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Update last signed-in timestamp on every authenticated request so we can track online/offline
    try {
      await db.updateLastSignIn(user.id);
    } catch (err) {
      console.warn("[Auth] Failed to update last sign-in", err);
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Optional authentication - doesn't fail if no token
async function optionalAuth(req: Request, res: Response, next: Function) {
  const token = req.cookies.auth_token;

  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await db.getUserById(decoded.userId);
        if (user) {
          (req as any).user = user;
        }
      }
    } catch (error) {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await db.registerUser(email, password, name);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, userId: result.userId });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await db.loginUser(email, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.cookie("auth_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ success: true, userId: result.userId });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req: Request, res: Response) => {
  res.clearCookie("auth_token");
  res.json({ success: true });
});

// ============================================================================
// USER ENDPOINTS (as specified in requirements)
// ============================================================================

// GET /users/:id - Returns user's name and link to profile picture
router.get("/users/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUser = (req as any).user;

    // If not authenticated, return 404
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if viewer has permission to see this profile
    const hasPermission = await db.canViewDetailedProfile(currentUser.id, userId);
    if (!hasPermission) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = await db.getProfileByUserId(userId);
    const photos = await db.getUserPhotos(userId);

    res.json({
      id: user.id,
      name: user.name || profile?.firstName || "Anonymous",
      profilePicture: photos[0]?.photoUrl || null,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:id/profile - Returns user's "about me" type information
router.get("/users/:id/profile", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUser = (req as any).user;

    // If not authenticated, return 404
    if (!currentUser) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check if viewer has permission to see this profile
    const hasPermission = await db.canViewDetailedProfile(currentUser.id, userId);
    if (!hasPermission) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = await db.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      id: userId,
      firstName: profile.firstName,
      age: profile.age,
      location: profile.location,
      latitude: profile.latitude,
      longitude: profile.longitude,
      bio: profile.bio,
      isVerified: profile.isVerified,
      profilePhotoUrl: profile.profilePhotoUrl,
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:id/bio - Returns biographical data used to power recommendations
router.get("/users/:id/bio", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUser = (req as any).user;

    // If not authenticated, return 404
    if (!currentUser) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check if viewer has permission to see this profile
    const hasPermission = await db.canViewDetailedProfile(currentUser.id, userId);
    if (!hasPermission) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = await db.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const interests = await db.getUserInterests(userId);
    const prompts = await db.getUserPrompts(userId);

    res.json({
      id: userId,
      gender: profile.gender,
      lookingFor: profile.lookingFor,
      age: profile.age,
      location: profile.location,
      interests: interests.map(i => i.interestName),
      prompts: prompts.map(p => ({
        question: p.promptText,
        answer: p.answer,
      })),
    });
  } catch (error) {
    console.error("Get bio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /me - Shortcut to /users/:id for authenticated user
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const profile = await db.getProfileByUserId(user.id);
    const photos = await db.getUserPhotos(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name || profile?.firstName || "Anonymous",
      profilePicture: photos[0]?.photoUrl || null,
      hasProfile: !!profile,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /me/profile
router.get("/me/profile", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const profile = await db.getProfileByUserId(user.id);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      id: user.id,
      firstName: profile.firstName,
      age: profile.age,
      gender: profile.gender,
      lookingFor: profile.lookingFor,
      location: profile.location,
      latitude: profile.latitude,
      longitude: profile.longitude,
      maxDistanceKm: profile.maxDistanceKm,
      allowOutsideRadius: profile.allowOutsideRadius,
      bio: profile.bio,
      isVerified: profile.isVerified,
    });

  } catch (error) {
    console.error("Get my profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:id/discovery - Returns full bio for discovery feed
router.get("/users/:id/discovery", optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUser = (req as any).user;

    // If not authenticated, return 404
    if (!currentUser) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check if viewer has permission to see this profile
    const hasPermission = await db.canViewDetailedProfile(currentUser.id, userId);
    if (!hasPermission) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const profile = await db.getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const interests = await db.getUserInterests(userId);
    const prompts = await db.getUserPrompts(userId);

    res.json({
      id: userId,
      gender: profile.gender,
      lookingFor: profile.lookingFor,
      age: profile.age,
      location: profile.location,
      interests: interests.map(i => i.interestName),
      prompts: prompts.map(p => ({
        question: p.promptText,
        answer: p.answer,
      })),
    });
  } catch (error) {
    console.error("Get discovery bio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /me/bio
router.get("/me/bio", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const profile = await db.getProfileByUserId(user.id);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const interests = await db.getUserInterests(user.id);
    const prompts = await db.getUserPrompts(user.id);

    res.json({
      id: user.id,
      gender: profile.gender,
      lookingFor: profile.lookingFor,
      age: profile.age,
      location: profile.location,
      interests: interests.map(i => i.interestName),
      prompts: prompts.map(p => ({
        question: p.promptText,
        answer: p.answer,
      })),
    });
  } catch (error) {
    console.error("Get my bio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /recommendations - Returns maximum of 10 recommendations
router.get("/recommendations", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const recommendations = await db.getDiscoveryFeed(user.id);

    // Return only IDs as specified
    res.json({
      recommendations: recommendations.map(r => ({ id: r.userId })),
    });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /connections - Returns list of connected profiles
router.get("/connections", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const matches = await db.getMyMatches(user.id);

    // Return only IDs as specified
    res.json({
      connections: matches.map(m => ({ id: m.otherUserId })),
    });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// CONNECTION REQUESTS (incoming likes)
// ============================================================================

// GET /connection-requests - list incoming connection requests for the current user
router.get("/connection-requests", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const requests = await db.getIncomingConnectionRequests(user.id);
    res.json({ requests });
  } catch (error) {
    console.error("Get incoming requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /connection-requests/:fromUserId/accept - accept an incoming request by liking back
router.post(
  "/connection-requests/:fromUserId/accept",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const fromUserId = parseInt(req.params.fromUserId, 10);
      // Accept by liking back
      const result = await db.createInteraction(user.id, fromUserId, "like");
      res.json({ success: true, matched: result.matched });
    } catch (error) {
      console.error("Accept connection request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /connection-requests/:fromUserId/reject - reject an incoming request by passing
router.post(
  "/connection-requests/:fromUserId/reject",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const fromUserId = parseInt(req.params.fromUserId, 10);
      // Reject by passing on the user
      await db.createInteraction(user.id, fromUserId, "pass");
      res.json({ success: true });
    } catch (error) {
      console.error("Reject connection request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// DELETE /connections/:matchId - disconnect an active match
router.delete(
  "/connections/:matchId",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const matchId = parseInt(req.params.matchId, 10);
      const ok = await db.disconnectMatch(matchId, user.id);
      if (!ok) {
        return res.status(404).json({ error: "Match not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Disconnect match error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// ADDITIONAL ENDPOINTS FOR FULL FUNCTIONALITY
// ============================================================================

// Profile management
router.put("/me/profile", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const profileData = req.body;

    await db.upsertProfile(user.id, profileData as any);

    res.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Prompts
router.get("/prompts", async (req: Request, res: Response) => {
  try {
    const prompts = await db.getAllPrompts();
    res.json({ prompts });
  } catch (error) {
    console.error("Get prompts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/prompts", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const prompts = await db.getUserPrompts(user.id);
    res.json({ prompts });
  } catch (error) {
    console.error("Get user prompts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me/prompts", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { promptId, answer, displayOrder } = req.body;

    await db.addUserPrompt(user.id, promptId, answer, displayOrder || 1);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Add prompt error:", error);

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Internal server error";

    const statusCode =
      message === "You can only select up to 5 prompts" ? 400 : 500;

    res.status(statusCode).json({ error: message });
  }
});

router.delete("/me/prompts/:id", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userPromptId = parseInt(req.params.id);

    await db.removeUserPromptById(user.id, userPromptId);

    res.json({ success: true });
  } catch (error) {
    console.error("Remove prompt error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Interests
router.get("/interests", async (req: Request, res: Response) => {
  try {
    const interests = await db.getAllInterests();
    res.json({ interests });
  } catch (error) {
    console.error("Get interests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/interests", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const interests = await db.getUserInterests(user.id);
    res.json({ interests });
  } catch (error) {
    console.error("Get user interests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me/interests", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { interestId } = req.body;

    await db.addUserInterest(user.id, interestId);

    res.json({ success: true });
  } catch (error) {
    console.error("Add interest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/me/interests/:interestId", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const interestId = parseInt(req.params.interestId);

    await db.removeUserInterest(user.id, interestId);

    res.json({ success: true });
  } catch (error) {
    console.error("Remove interest error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Discovery and interactions
router.post("/interactions", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targetUserId, type, promptId, comment } = req.body;

    const result = await db.createInteraction(user.id, targetUserId, type, promptId, comment);

    res.json({ success: true, matched: result.matched });
  } catch (error) {
    console.error("Create interaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /me/likes - people I liked (outgoing likes/comments)
router.get("/me/likes", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const likes = await db.getUsersILiked(user.id);

    res.json({ likes });
  } catch (error) {
    console.error("Get my likes error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Matches
// GET /matches - Return list of matches enriched with last message, unread count & online status
router.get("/matches", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const myMatches = await db.getMyMatches(user.id);

    // Enrich each match with last message, unread count and online status
    const enriched = await Promise.all(
      myMatches.map(async (m: any) => {
        // Get all messages for this match (ordered asc)
        const msgs = await db.getMessages(m.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        // Count unread messages for current user
        let unreadCount = 0;
        msgs.forEach((msg: any) => {
          if (msg.receiverId === user.id && msg.isRead === false) {
            unreadCount++;
          }
        });
        // Determine online status of the other user (online if lastSignedIn within last 5 minutes)
        const other = await db.getUserById(m.otherUserId);
        let online = false;
        if (other && other.lastSignedIn) {
          const last = new Date(other.lastSignedIn).getTime();
          const now = Date.now();
          online = now - last < 5 * 60 * 1000;
        }
        // Get the latest photo for the other user.
        let photoUrl: string | null = null;
        try {
          const photos = await db.getUserPhotos(m.otherUserId);
          if (photos && photos.length > 0) {
            const lastPhoto = photos[photos.length - 1];
            photoUrl = lastPhoto.photoUrl || null;
          }
        } catch (err) {
          console.warn("Failed to load photo for match", m.otherUserId, err);
        }
        return { ...m, lastMessage: lastMsg, unreadCount, online, photoUrl };
      })
    );
    // Sort by last message timestamp (or matchedAt if none) descending
    enriched.sort((a: any, b: any) => {
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.createdAt).getTime()
        : new Date(a.matchedAt).getTime();
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.createdAt).getTime()
        : new Date(b.matchedAt).getTime();
      return bTime - aTime;
    });
    res.json({ matches: enriched });
  } catch (error) {
    console.error("Get matches error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Messages
router.get("/matches/:matchId/messages", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const matchId = parseInt(req.params.matchId);
    // Optional pagination parameters
    const rawLimit = req.query.limit as string | undefined;
    const rawPage = req.query.page as string | undefined;
    let limit: number | undefined;
    let offset: number | undefined;
    if (rawLimit) {
      const parsed = parseInt(rawLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
      }
    }
    if (rawPage && limit) {
      const p = parseInt(rawPage, 10);
      if (!isNaN(p) && p > 1) {
        offset = (p - 1) * limit;
      }
    }
    let msgs: any[];
    // If limit provided, fetch one extra record to determine hasMore
    if (typeof limit === "number") {
      const fetchLimit = limit + 1;
      msgs = await db.getMessages(matchId, fetchLimit, offset);
      let hasMore = false;
      if (msgs.length > limit) {
        hasMore = true;
        msgs = msgs.slice(0, limit);
      }
      const page = rawPage ? parseInt(rawPage, 10) || 1 : 1;
      return res.json({ messages: msgs, page, limit, hasMore });
    } else {
      msgs = await db.getMessages(matchId);
      return res.json({ messages: msgs });
    }
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/matches/:matchId/messages", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const matchId = parseInt(req.params.matchId);
    const { content, receiverId } = req.body;

    const message = await db.sendMessage(matchId, user.id, receiverId, content);
    // Push the new message to the receiver in real time via WebSocket
    try {
      emitMessage(receiverId, message);
    } catch (err) {
      // If emitting fails (e.g. user offline), we silently ignore.
    }
    res.json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark all messages in this match as read for the current user
router.post("/matches/:matchId/read", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const matchId = parseInt(req.params.matchId, 10);
    await db.markMessagesAsRead(matchId, user.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Mark messages read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Typing indicator for chat: create or clear typing notifications
router.post("/matches/:matchId/typing", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const matchId = parseInt(req.params.matchId, 10);
    const { receiverId, isTyping } = req.body as {
      receiverId?: number;
      isTyping?: boolean;
    };
    if (!receiverId || typeof isTyping === "undefined") {
      return res.status(400).json({ error: "Missing receiverId or isTyping" });
    }

    if (isTyping) {
      // IMPORTANT: order = (userId, type, relatedUserId, relatedMatchId, content)
      await db.createNotification(receiverId, "message", "typing", user.id, matchId );

      try {
        emitTyping(receiverId, matchId, user.id, true);
      } catch (err) {}
    } else {
      // IMPORTANT: db signature = (matchId, receiverId, senderId)
      await db.markTypingNotificationsAsRead(matchId, receiverId, user.id);

      try {
        emitTyping(receiverId, matchId, user.id, false);
      } catch (err) {}
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Typing indicator error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get my notifications (latest 50)
router.get("/me/notifications", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const notifications = await db.getMyNotifications(user.id);
    res.json({ notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark a notification as read
router.post(
  "/me/notifications/:id/read",
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const notifId = parseInt(req.params.id, 10);
      await db.markNotificationAsRead(notifId, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Safety
router.post("/reports", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { reportedUserId, reason } = req.body;

    await db.reportUser(user.id, reportedUserId, reason);

    res.json({ success: true });
  } catch (error) {
    console.error("Report user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/blocks", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { blockedUserId } = req.body;

    await db.blockUser(user.id, blockedUserId);

    res.json({ success: true });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Photos
router.get("/me/photos", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const photos = await db.getUserPhotos(user.id);

    // IMPORTANT: return the plain array, because the frontend expects [] not { photos: [] }
    res.json(photos);
  } catch (error) {
    console.error("Get photos error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me/photos", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { url } = req.body as { url?: string };

    if (!url) {
      return res.status(400).json({ error: "Missing photo url" });
    }

    const existing = await db.getUserPhotos(user.id);
    const displayOrder =
      existing.length > 0
        ? existing[existing.length - 1].displayOrder + 1
        : 1;

    await db.addPhoto(user.id, url, displayOrder);

    res.json({ success: true });
  } catch (error) {
    console.error("Add photo error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/me/photos/:photoId", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const photoId = parseInt(req.params.photoId, 10);

    await db.deletePhoto(photoId, user.id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete photo error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Account deletion - proxy to Go backend
router.delete("/me", authenticateUser, async (req: Request, res: Response) => {
  const GO_BACKEND_URL = process.env.GO_BACKEND_URL || "http://localhost:8080";
  
  try {
    // Forward the request to Go backend
    const url = `${GO_BACKEND_URL}/api/me`;
    const proxyRes = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.cookie || "", // Forward auth cookie
      },
      credentials: "include",
    });
    
    // Forward response headers (especially cookies)
    proxyRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "content-length") {
        res.setHeader(key, value);
      }
    });
    
    // Forward status code
    res.status(proxyRes.status);
    
    // Forward response body
    const body = await proxyRes.text();
    res.send(body);
  } catch (error) {
    console.error("[Proxy] Error forwarding DELETE /me to Go backend:", error);
    res.status(502).json({ error: "Backend service unavailable" });
  }
});

export default router;
