import {
  eq,
  and,
  or,
  asc,
  desc,
  ne,
  sql,
  inArray,
  notInArray,
} from "drizzle-orm";

import bcrypt from "bcryptjs";
import { generateToken } from "./auth";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  users,
  profiles,
  prompts,
  userPrompts,
  interests,
  userInterests,
  photos,
  interactions,
  matches,
  messages,
  notifications,
  blocks,
  reports,
  InsertUser,
} from "../drizzle/schema";

const MIN_SCORE = 50; // Requires meaningful compatibility beyond just gender match
let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function createUser(
  email: string,
  password: string,
  name?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await db.insert(users).values({
    email,
    password: hashedPassword,
    name: name || null,
  });

  return result;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export async function updateLastSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProfile(
  userId: number,
  data: {
    firstName?: string;
    age?: number;
    gender?:
      | "male"
      | "female"
      | "non-binary"
      | "other"
      | "prefer-not-to-say";
    lookingFor?: "male" | "female" | "non-binary" | "everyone";
    location?: string | null;
    bio?: string | null;
    profilePhotoUrl?: string | null;
    isVerified?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    maxDistanceKm?: number | null;
    allowOutsideRadius?: boolean | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getProfileByUserId(userId);

  if (existing) {
    await db
      .update(profiles)
      .set(data as any)
      .where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values({ userId, ...data } as any);
  }
}

// ============================================================================
// PROMPTS
// ============================================================================

export async function getAllPrompts() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(prompts);
}

export async function getUserPrompts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: userPrompts.id,
      promptId: userPrompts.promptId,
      promptText: prompts.text,
      promptCategory: prompts.category,
      answer: userPrompts.answer,
      displayOrder: userPrompts.displayOrder,
    })
    .from(userPrompts)
    .innerJoin(prompts, eq(userPrompts.promptId, prompts.id))
    .where(eq(userPrompts.userId, userId))
    .orderBy(asc(userPrompts.displayOrder));
}

export async function addUserPrompt(
  userId: number,
  promptId: number,
  answer: string,
  displayOrder: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all prompts for this user (for counting + checking existing)
  const existingForUser = await db
    .select({
      id: userPrompts.id,
      promptId: userPrompts.promptId,
    })
    .from(userPrompts)
    .where(eq(userPrompts.userId, userId));

  const existingRow = existingForUser.find(
    (p) => p.promptId === promptId
  );

  // 🔁 If this (userId, promptId) already exists → UPDATE answer + order
  if (existingRow) {
    await db
      .update(userPrompts)
      .set({
        answer,
        displayOrder,
        updatedAt: new Date(),
      } as any)
      .where(eq(userPrompts.id, existingRow.id));
    return;
  }

  // Otherwise, enforce max 5 prompts, then INSERT a new one
  if (existingForUser.length >= 5) {
    throw new Error("You can only select up to 5 prompts");
  }

  await db.insert(userPrompts).values({
    userId,
    promptId,
    answer,
    displayOrder,
  } as any);
}

export async function removeUserPrompt(userId: number, promptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(userPrompts)
    .where(
      and(eq(userPrompts.userId, userId), eq(userPrompts.promptId, promptId))
    );
}

export async function removeUserPromptById(userId: number, userPromptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(userPrompts)
    .where(
      and(eq(userPrompts.userId, userId), eq(userPrompts.id, userPromptId))
    );
}

// ============================================================================
// INTERESTS
// ============================================================================

export async function getAllInterests() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(interests);
}

export async function getUserInterests(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: userInterests.id,
      interestId: userInterests.interestId,
      interestName: interests.name,
      interestCategory: interests.category,
    })
    .from(userInterests)
    .innerJoin(interests, eq(userInterests.interestId, interests.id))
    .where(eq(userInterests.userId, userId));
}

export async function addUserInterest(userId: number, interestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If this (userId, interestId) combo already exists, do nothing
  const existing = await db
    .select({ id: userInterests.id })
    .from(userInterests)
    .where(
      and(
        eq(userInterests.userId, userId),
        eq(userInterests.interestId, interestId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // already saved, no insert needed
    return;
  }

  // otherwise insert a new interest row
  await db.insert(userInterests).values({ userId, interestId });
}

export async function removeUserInterest(userId: number, interestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(userInterests)
    .where(
      and(
        eq(userInterests.userId, userId),
        eq(userInterests.interestId, interestId)
      )
    );
}

// ============================================================================
// PHOTOS
// ============================================================================

export async function getUserPhotos(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(photos)
    .where(eq(photos.userId, userId))
    .orderBy(asc(photos.displayOrder));
}

export async function addPhoto(
  userId: number,
  url: string,
  displayOrder: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 🔁 For now we only support ONE profile photo:
  // remove any existing photos for this user
  await db.delete(photos).where(eq(photos.userId, userId));

  // then insert the new one
  await db.insert(photos).values({
    userId,
    photoUrl: url,
    displayOrder,
  });
}

export async function deletePhoto(photoId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(photos)
    .where(and(eq(photos.id, photoId), eq(photos.userId, userId)));
}

// ============================================================================
// DISCOVERY FEED
// ============================================================================

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
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

export async function getDiscoveryFeed(
  userId: number,
  filters?: {
    minAge?: number;
    maxAge?: number;
    gender?: string;
    maxDistance?: number; // optional override from UI if needed later
  }
) {
  const db = await getDb();
  if (!db) return [];

  const myProfile = await getProfileByUserId(userId);
  if (!myProfile) return [];

  // Users I've already interacted with (like / pass / comment)
  const interactedUserIds = await db
    .select({ toUserId: interactions.toUserId })
    .from(interactions)
    .where(eq(interactions.fromUserId, userId));

  const interactedIds = interactedUserIds.map((i) => i.toUserId);

  // Users I've blocked
  const blockedUserIds = await db
    .select({ blockedUserId: blocks.blockedUserId })
    .from(blocks)
    .where(eq(blocks.blockerId, userId));

  const blockedIds = blockedUserIds.map((b) => b.blockedUserId);

  // Base query: candidates that are not me / not already interacted / not blocked
  const baseConditions = [
    ne(profiles.userId, userId),
    ...(interactedIds.length > 0
      ? [notInArray(profiles.userId, interactedIds)]
      : []),
    ...(blockedIds.length > 0
      ? [notInArray(profiles.userId, blockedIds)]
      : []),
    ...(filters?.minAge ? [sql`${profiles.age} >= ${filters.minAge}` as any] : []),
    ...(filters?.maxAge ? [sql`${profiles.age} <= ${filters.maxAge}` as any] : []),
    ...(filters?.gender && filters.gender !== "everyone"
      ? [sql`${profiles.gender} = ${filters.gender}` as any]
      : []),
  ];

  const query = db
    .select({
      userId: profiles.userId,
      firstName: profiles.firstName,
      age: profiles.age,
      gender: profiles.gender,
      lookingFor: profiles.lookingFor,
      location: profiles.location,
      bio: profiles.bio,
      profilePhotoUrl: profiles.profilePhotoUrl,
      isVerified: profiles.isVerified,
      latitude: profiles.latitude,
      longitude: profiles.longitude,
    })
    .from(profiles)
    .where(and(...baseConditions))
    .limit(50);

  const feedProfiles = await query;

  // ---------------------------
  // Location + radius handling
  // ---------------------------
  // Helper to check if coordinates are valid (not null and not 0.0,0.0)
  const isValidCoordinate = (lat: number | null, lng: number | null): boolean => {
    if (lat === null || lng === null) {
      return false;
    }
    // Treat (0,0) as invalid - it's not a real user location
    const epsilon = 0.0001;
    if (Math.abs(lat) < epsilon && Math.abs(lng) < epsilon) {
      return false;
    }
    return true;
  };

  const hasMyCoords = isValidCoordinate(
    myProfile.latitude ?? null,
    myProfile.longitude ?? null
  );

  const radiusKm =
    (filters?.maxDistance ?? myProfile.maxDistanceKm ?? null) as number | null;

  // Start from all candidates, and compute distance when possible
  let locationFiltered = feedProfiles.map((profile: any) => {
    let distanceKm: number | null = null;

    if (
      hasMyCoords &&
      isValidCoordinate(profile.latitude ?? null, profile.longitude ?? null)
    ) {
      distanceKm = haversineDistanceKm(
        myProfile.latitude as number,
        myProfile.longitude as number,
        profile.latitude,
        profile.longitude
      );
    }

    return { ...profile, distanceKm };
  });

  // If we *do* have GPS + radius, try to apply it.
  // Only restrict the list if radius actually returns someone.
  if (hasMyCoords && radiusKm && radiusKm > 0) {
    // Helper to extract city and country from location string
    const parseLocation = (loc?: string | null) => {
      if (!loc) return { city: null, country: null };
      const parts = loc.split(",").map((s) => s.trim().toLowerCase());
      if (parts.length === 2) {
        return { city: parts[0], country: parts[1] };
      } else if (parts.length === 1) {
        return { city: null, country: parts[0] };
      }
      return { city: null, country: null };
    };

    const myLocation = parseLocation(myProfile.location);

    const withinRadius = locationFiltered.filter((p) => {
      // If they have GPS and are within radius, include them
      if (p.distanceKm !== null && p.distanceKm <= radiusKm) {
        return true;
      }

      // If they don't have GPS, use city/country text as fallback
      if (p.distanceKm === null && p.location) {
        const theirLocation = parseLocation(p.location);
        
        // Prioritize same city
        if (myLocation.city && theirLocation.city && 
            myLocation.city === theirLocation.city) {
          return true;
        }
        
        // Fallback to same country
        if (myLocation.country && theirLocation.country && 
            myLocation.country === theirLocation.country) {
          return true;
        }
      }

      return false;
    });

    if (withinRadius.length > 0) {
      locationFiltered = withinRadius;
    }
  }

  // My interests + prompts
  const myInterestsRows = await getUserInterests(userId);
  const myPromptsRows = await getUserPrompts(userId);

  const myInterestNames = new Set(
    myInterestsRows.map((i: any) => i.interestName.toLowerCase())
  );
  const myPromptCategories = new Set(
    myPromptsRows.map((p: any) => p.promptCategory)
  );

  // Enrich each candidate with prompts, interests, and a match score
    // Enrich each candidate with prompts, interests, and a match score
  const enriched = await Promise.all(
    locationFiltered.map(async (profile: any) => {
      const promptsForUser = await getUserPrompts(profile.userId);
      const interestsForUser = await getUserInterests(profile.userId);

      const theirInterestNames = interestsForUser.map((i: any) =>
        i.interestName.toLowerCase()
      );
      const theirPromptCategories = promptsForUser.map(
        (p: any) => p.promptCategory
      );

      const score = computeMatchScore({
        me: {
          gender: myProfile.gender,
          lookingFor: myProfile.lookingFor,
          age: myProfile.age,
          location: myProfile.location,
          interests: myInterestNames,
          promptCategories: myPromptCategories,
        },
        other: {
          gender: profile.gender,
          lookingFor: profile.lookingFor,
          age: profile.age,
          location: profile.location,
          interests: new Set(theirInterestNames),
          promptCategories: new Set(theirPromptCategories),
        },
      });

      return {
        ...profile,
        score,
      };
    })
  );

  // --- NEW: prefer same-country candidates for ranking ---
  const extractCountry = (loc?: string | null): string | null => {
    if (!loc) return null;
    const parts = loc.toLowerCase().split(",").map((s) => s.trim());
    return parts[parts.length - 1] || null;
  };

  const myCountry = extractCountry(myProfile.location);

  // start from all scored candidates
  let candidates = enriched.filter((p) => p.score >= MIN_SCORE);

  // if there ARE same-country profiles, only keep those
  if (myCountry) {
    const sameCountry = candidates.filter((p) => {
      const otherCountry = extractCountry(p.location);
      return otherCountry === myCountry;
    });

    if (sameCountry.length > 0) {
      candidates = sameCountry;
    }
  }

  const ranked = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return ranked;
}

type MatchPerson = {
  gender?: string | null;
  lookingFor?: string | null;
  age?: number | null;
  location?: string | null;
  interests: Set<string> | string[];
  promptCategories: Set<string> | string[];
};

function computeMatchScore({
  me,
  other,
}: {
  me: MatchPerson;
  other: MatchPerson;
}): number {
  let score = 0;

  const myGender = (me.gender || "").toLowerCase();
  const myLookingFor = (me.lookingFor || "").toLowerCase();
  const otherGender = (other.gender || "").toLowerCase();
  const otherLookingFor = (other.lookingFor || "").toLowerCase();

  // 1) Hard rule: mutual gender preference must not clash
  const iLikeTheirGender =
    myLookingFor && myLookingFor !== "everyone"
      ? otherGender === myLookingFor
      : true;

  const theyLikeMyGender =
    otherLookingFor && otherLookingFor !== "everyone"
      ? myGender === otherLookingFor
      : true;

  if (!iLikeTheirGender || !theyLikeMyGender) {
    // Completely incompatible – don't recommend
    return 0;
  }

  // If they mutually fit each other's preference, give a base boost
  if (iLikeTheirGender && theyLikeMyGender) {
    score += 30;
  }

  // 2) Age closeness
  if (typeof me.age === "number" && typeof other.age === "number") {
    const diff = Math.abs(me.age - other.age);
    if (diff <= 2) score += 20;
    else if (diff <= 5) score += 15;
    else if (diff <= 10) score += 8;
  }

  // 3) Location (same city vs same country)
  if (me.location && other.location) {
    const myLoc = me.location.toLowerCase();
    const otherLoc = other.location.toLowerCase();

    if (myLoc === otherLoc) {
      score += 25;
    } else {
      const myParts = myLoc.split(",").map((s) => s.trim());
      const otherParts = otherLoc.split(",").map((s) => s.trim());
      const myCountry = myParts[myParts.length - 1];
      const otherCountry = otherParts[otherParts.length - 1];

      if (myCountry && otherCountry && myCountry === otherCountry) {
        score += 15;
      }
    }
  }

  // 4) Shared interests
  const myInterestsSet =
    me.interests instanceof Set ? me.interests : new Set(me.interests);
  const otherInterestsSet =
    other.interests instanceof Set ? other.interests : new Set(other.interests);

  let sharedInterests = 0;
  otherInterestsSet.forEach((i) => {
    if (myInterestsSet.has(i)) sharedInterests++;
  });

  score += Math.min(20, sharedInterests * 5);

  // 5) Shared prompt categories
  const myPromptsSet =
    me.promptCategories instanceof Set
      ? me.promptCategories
      : new Set(me.promptCategories);
  const otherPromptsSet =
    other.promptCategories instanceof Set
      ? other.promptCategories
      : new Set(other.promptCategories);

  let sharedPromptCats = 0;
  otherPromptsSet.forEach((c) => {
    if (myPromptsSet.has(c)) sharedPromptCats++;
  });

  // ✅ Reduced prompt influence: max +6
  if (sharedPromptCats >= 1) score += 3;
  if (sharedPromptCats >= 2) score += 3; // total up to +6

  return score;
}

// ============================================================================
// INTERACTIONS
// ============================================================================

export async function createInteraction(
  fromUserId: number,
  toUserId: number,
  type: "like" | "comment" | "pass",
  userPromptId?: number,
  comment?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(interactions).values({
    fromUserId,
    toUserId,
    type,
    userPromptId: userPromptId || null,
    comment: comment || null,
  });

  // Check if it's a mutual match
  if (type === "like" || type === "comment") {
    const reciprocalLike = await db
      .select()
      .from(interactions)
      .where(
        and(
          eq(interactions.fromUserId, toUserId),
          eq(interactions.toUserId, fromUserId),
          or(
            eq(interactions.type, "like"),
            eq(interactions.type, "comment")
          )
        )
      )
      .limit(1);

    if (reciprocalLike.length > 0) {
      // Create match
      const existingMatch = await db
        .select()
        .from(matches)
        .where(
          or(
            and(
              eq(matches.user1Id, fromUserId),
              eq(matches.user2Id, toUserId)
            ),
            and(
              eq(matches.user1Id, toUserId),
              eq(matches.user2Id, fromUserId)
            )
          )
        )
        .limit(1);

      if (existingMatch.length === 0) {
        await db.insert(matches).values({
          user1Id: fromUserId,
          user2Id: toUserId,
        });

        return { matched: true };
      }
    }
  }

  return { matched: false };
}

// ============================================================================
// LIKES (people I liked)
// ============================================================================

export async function getUsersILiked(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      toUserId: interactions.toUserId,
      createdAt: interactions.createdAt,
    })
    .from(interactions)
    .where(
      and(
        eq(interactions.fromUserId, userId),
        or(eq(interactions.type, "like"), eq(interactions.type, "comment"))
      )
    )
    .orderBy(desc(interactions.createdAt));

  const uniqueUserIds: number[] = [];
  for (const row of rows) {
    if (!uniqueUserIds.includes(row.toUserId)) {
      uniqueUserIds.push(row.toUserId);
    }
  }

  const enriched = await Promise.all(
    uniqueUserIds.map(async (otherUserId) => {
      const profile = await getProfileByUserId(otherUserId);
      return {
        otherUserId,
        profile,
      };
    })
  );

  return enriched;
}

// ============================================================================
// MATCHES
// ============================================================================

export async function getMyMatches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Only return matches that are still active.  When a match is
  // disconnected the row remains with isActive=false, so filter
  // accordingly.  Without this filter, users could continue to see
  // old connections that were previously disconnected.
  const myMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.isActive, true),
        or(eq(matches.user1Id, userId), eq(matches.user2Id, userId))
      )
    )
    .orderBy(desc(matches.matchedAt));

  const enriched = await Promise.all(
    myMatches.map(async (match) => {
      const otherUserId =
        match.user1Id === userId ? match.user2Id : match.user1Id;
      const profile = await getProfileByUserId(otherUserId);

      return {
        id: match.id,
        otherUserId,
        matchedAt: match.matchedAt,
        profile,
      };
    })
  );

  return enriched;
}

// ============================================================================
// CONNECTION REQUESTS (incoming likes)
// ============================================================================

/**
 * Return a list of users who have expressed interest in the given
 * user (via a "like" or "comment" interaction) but for whom there is
 * not yet an active match and no response has been recorded by the
 * current user.  Each request is enriched with the other user's
 * profile and latest photo.
 */
export async function getIncomingConnectionRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // First, get all incoming interactions where the current user is
  // the recipient and the type is like/comment.  We order by
  // createdAt descending so recent requests appear first.  We'll
  // deduplicate by fromUserId later.
  const rows = await db
    .select({
      fromUserId: interactions.fromUserId,
      createdAt: interactions.createdAt,
    })
    .from(interactions)
    .where(
      and(
        eq(interactions.toUserId, userId),
        or(
          eq(interactions.type, "like"),
          eq(interactions.type, "comment"),
        ),
      ),
    )
    .orderBy(desc(interactions.createdAt));

  const uniqueRequestIds: number[] = [];
  for (const row of rows) {
    const fromId = row.fromUserId;
    if (uniqueRequestIds.includes(fromId)) continue;
    // Exclude if there is an active match
    const existingMatch = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.isActive, true),
          or(
            and(eq(matches.user1Id, fromId), eq(matches.user2Id, userId)),
            and(eq(matches.user1Id, userId), eq(matches.user2Id, fromId)),
          ),
        ),
      )
      .limit(1);
    if (existingMatch.length > 0) {
      continue;
    }
    // Exclude if current user has already responded with a like, comment or pass
    const responded = await db
      .select()
      .from(interactions)
      .where(
        and(
          eq(interactions.fromUserId, userId),
          eq(interactions.toUserId, fromId),
          or(
            eq(interactions.type, "like"),
            eq(interactions.type, "comment"),
            eq(interactions.type, "pass"),
          ),
        ),
      )
      .limit(1);
    if (responded.length > 0) {
      continue;
    }
    uniqueRequestIds.push(fromId);
  }

  const enriched = await Promise.all(
    uniqueRequestIds.map(async (fromId) => {
      const profile = await getProfileByUserId(fromId);
      // Get latest photo for avatar
      let photoUrl: string | null = null;
      try {
        const photos = await getUserPhotos(fromId);
        if (photos && photos.length > 0) {
          const lastPhoto = photos[photos.length - 1];
          photoUrl = lastPhoto.photoUrl || null;
        }
      } catch {
        // ignore
      }
      return { fromUserId: fromId, profile, photoUrl };
    }),
  );
  return enriched;
}

// ============================================================================
// MATCH DISCONNECT
// ============================================================================

/**
 * Deactivate a match (disconnect the two users).  This function
 * updates the match's `isActive` flag to false and marks all
 * messages in the match as read.  It returns true if the match was
 * successfully disconnected, or false if no active match was found or
 * the user is not part of the match.
 */
export async function disconnectMatch(matchId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch the match and verify the user is part of it and it's active
  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (matchRows.length === 0) return false;
  const match = matchRows[0];
  if (!match.isActive) return false;
  if (match.user1Id !== userId && match.user2Id !== userId) return false;

  // Mark match inactive
  await db
    .update(matches)
    .set({ isActive: false })
    .where(eq(matches.id, matchId));
  // Mark all messages as read to clear unread counts
  await db
    .update(messages)
    .set({ isRead: true })
    .where(eq(messages.matchId, matchId));
  return true;
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function getMessages(
  matchId: number,
  limit?: number,
  offset?: number
) {
  const db = await getDb();
  if (!db) return [];

  const base = db
    .select()
    .from(messages)
    .where(eq(messages.matchId, matchId))
    .orderBy(asc(messages.createdAt));

  // If limit is provided, apply it (and offset safely)
  if (typeof limit === "number") {
    const safeLimit = Math.max(0, limit);
    const safeOffset = typeof offset === "number" && offset > 0 ? offset : 0;
    return await base.limit(safeLimit).offset(safeOffset);
  }

  return await base;
}

export async function sendMessage(
  matchId: number,
  senderId: number,
  receiverId: number,
  content: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert the new message and return the inserted row so callers have timestamps
  const [inserted] = await db
    .insert(messages)
    .values({ matchId, senderId, receiverId, content, createdAt: sql`timezone('utc', now())` })
    .returning();

  // Create a chat notification for the receiver so unread badge shows up
  try {
    await createNotification(
      receiverId,
      "message",
      "message",
      senderId,
      matchId
    );
  } catch (err) {
    // log and ignore notification errors – chat still works without them
    console.warn("[DB] Failed to create chat notification:", err);
  }

  return inserted;
}

// ============================================================================
// MESSAGE READ & TYPING SUPPORT
// ============================================================================

/**
 * Mark all messages in a match as read for a given receiver. Used when the user
 * opens a chat or when polling for unread counts so badges clear.
 */
export async function markMessagesAsRead(
  matchId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.matchId, matchId),
        eq(messages.receiverId, userId),
        eq(messages.isRead, false)
      )
    );
}

/**
 * Create a notification row. Notifications allow us to surface unread messages
 * and typing indicators even while the recipient is offline. Content can be
 * arbitrary (e.g. "message" or "typing"). The type should be one of the
 * predefined notification types (e.g. "message", "match", etc).
 */
export async function createNotification(
  userId: number,
  type: string,
  content: string,
  relatedUserId?: number | null,
  relatedMatchId?: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(notifications).values({
    userId,
    type: type as any,
    content,
    relatedUserId: relatedUserId ?? null,
    relatedMatchId: relatedMatchId ?? null,
  });
}

/**
 * Clear typing notifications for a given match. When a user stops typing or
 * opens the conversation, remove the pending "typing" notifications so the
 * indicator disappears.
 */
export async function markTypingNotificationsAsRead(
  matchId: number,
  senderId: number,
  receiverId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, receiverId),
        eq(notifications.relatedMatchId, matchId),
        eq(notifications.relatedUserId, senderId),
        eq(notifications.type, "message"),
        eq(notifications.content, "typing"),
        eq(notifications.isRead, false)
      )
    );
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function getMyNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function markNotificationAsRead(
  notificationId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );
}

// ============================================================================
// SAFETY
// ============================================================================

export async function reportUser(
  reporterId: number,
  reportedUserId: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(reports).values({
    reporterId,
    reportedUserId,
    reason,
  });
}

export async function blockUser(userId: number, blockedUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(blocks).values({
    blockerId: userId,
    blockedUserId,
  });
}

// ============================================================================
// AUTH FUNCTIONS
// ============================================================================

export async function registerUser(
  email: string,
  password: string,
  name?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { success: false, error: "Email already registered" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user (Postgres)
  const [inserted] = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      name: name || null,
    })
    .returning({ id: users.id });

  return { success: true, userId: inserted.id };
}

export async function loginUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.password) {
    return { success: false, error: "Invalid credentials" };
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return { success: false, error: "Invalid credentials" };
  }

  // Generate token
  const token = generateToken({ userId: user.id, email: user.email });

  return { success: true, userId: user.id, token };
}

/**
 * Delete a user account and all associated data
 */
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete in order to respect foreign key constraints
  // 1) Delete notifications
  await db
    .delete(notifications)
    .where(eq(notifications.userId, userId));

  // 2) Delete messages where user is sender or receiver
  await db
    .delete(messages)
    .where(or(
      eq(messages.senderId, userId),
      eq(messages.receiverId, userId)
    ));

  // 3) Delete matches where user is involved
  await db
    .delete(matches)
    .where(or(
      eq(matches.user1Id, userId),
      eq(matches.user2Id, userId)
    ));

  // 4) Delete interactions (sent and received)
  await db
    .delete(interactions)
    .where(or(
      eq(interactions.fromUserId, userId),
      eq(interactions.toUserId, userId)
    ));

  // 5) Delete reports (made by user and against user)
  await db
    .delete(reports)
    .where(or(
      eq(reports.reporterId, userId),
      eq(reports.reportedUserId, userId)
    ));

  // 6) Delete blocks (made by user and against user)
  await db
    .delete(blocks)
    .where(or(
      eq(blocks.blockerId, userId),
      eq(blocks.blockedUserId, userId)
    ));

  // 7) Delete user photos
  await db
    .delete(photos)
    .where(eq(photos.userId, userId));

  // 8) Delete user interests
  await db
    .delete(userInterests)
    .where(eq(userInterests.userId, userId));

  // 9) Delete user prompts
  await db
    .delete(userPrompts)
    .where(eq(userPrompts.userId, userId));

  // 10) Delete profile
  await db
    .delete(profiles)
    .where(eq(profiles.userId, userId));

  // 11) Finally, delete the user
  await db
    .delete(users)
    .where(eq(users.id, userId));
}

/**
 * Check if two users can see each other's detailed info
 * Returns true if:
 * - They are matched (connected)
 * - There's a pending interaction (like) from either user
 */
export async function canViewDetailedProfile(
  viewerId: number,
  targetUserId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Can always view your own profile
  if (viewerId === targetUserId) return true;

  // Check if they're matched
  const matchExists = await db
    .select()
    .from(matches)
    .where(
      or(
        and(eq(matches.user1Id, viewerId), eq(matches.user2Id, targetUserId)),
        and(eq(matches.user1Id, targetUserId), eq(matches.user2Id, viewerId))
      )
    )
    .limit(1);

  if (matchExists.length > 0) {
    return true; // They're connected
  }

  // Check if there's a pending like from either user
  const interactionExists = await db
    .select()
    .from(interactions)
    .where(
      or(
        and(
          eq(interactions.fromUserId, viewerId),
          eq(interactions.toUserId, targetUserId),
          eq(interactions.type, "like")
        ),
        and(
          eq(interactions.fromUserId, targetUserId),
          eq(interactions.toUserId, viewerId),
          eq(interactions.type, "like")
        )
      )
    )
    .limit(1);

  if (interactionExists.length > 0) {
    return true; // There's a connection request
  }

  // Check if target is in viewer's recommendations
  const recommendations = await getDiscoveryFeed(viewerId);
  if (recommendations.some(r => r.userId === targetUserId)) {
    return true; // Target is recommended to viewer
  }

  return false;
}
