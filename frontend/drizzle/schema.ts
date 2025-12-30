import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  real,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * ENUMS (PostgreSQL enum types)
 * ------------------------------
 * First argument = DB enum type name
 * Column name is passed in the function call later.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const genderEnum = pgEnum("gender", [
  "male",
  "female",
  "non-binary",
  "other",
  "prefer-not-to-say",
]);

export const lookingForEnum = pgEnum("lookingFor", [
  "male",
  "female",
  "non-binary",
  "everyone",
]);

export const interestCategoryEnum = pgEnum("interest_category", [
  "hobbies",
  "music",
  "food",
  "lifestyle",
  "sports",
  "entertainment",
  "travel",
  "other",
]);

export const interactionTypeEnum = pgEnum("interaction_type", [
  "like",
  "comment",
  "pass",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "resolved",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "match",
  "message",
  "like",
  "comment",
]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name"),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User profiles with biographical information for matching
 */
export const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    username: varchar("username", { length: 100 }),
    firstName: varchar("firstName", { length: 100 }),
    lastName: varchar("lastName", { length: 100 }),
    age: integer("age"),
    gender: genderEnum("gender"),
    lookingFor: lookingForEnum("lookingFor"),
    bio: text("bio"),
    location: varchar("location", { length: 255 }),
    latitude: real("latitude"),
    longitude: real("longitude"),
    maxDistanceKm: integer("maxDistanceKm").default(50).notNull(),
    allowOutsideRadius: boolean("allowOutsideRadius").default(false).notNull(),
    profilePhotoUrl: text("profilePhotoUrl"),
    isProfileComplete: boolean("isProfileComplete").default(false).notNull(),
    isVerified: boolean("isVerified").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("profiles_userId_idx").on(table.userId),
  }),
);

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/**
 * Predefined prompts that users can choose from
 */
export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  category: varchar("category", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;

/**
 * User's selected prompts and answers
 */
export const userPrompts = pgTable(
  "userPrompts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    promptId: integer("promptId").notNull(),
    answer: text("answer").notNull(),
    displayOrder: integer("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userPrompts_userId_idx").on(table.userId),
    userPromptUnique: uniqueIndex("userPrompts_user_prompt_unique").on(
      table.userId,
      table.promptId,
    ),
  }),
);

export type UserPrompt = typeof userPrompts.$inferSelect;
export type InsertUserPrompt = typeof userPrompts.$inferInsert;

/**
 * Interest categories
 */
export const interests = pgTable("interests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  category: interestCategoryEnum("category").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Interest = typeof interests.$inferSelect;
export type InsertInterest = typeof interests.$inferInsert;

/**
 * User interests mapping
 */
export const userInterests = pgTable(
  "userInterests",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    interestId: integer("interestId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userInterests_userId_idx").on(table.userId),
    userInterestUnique: uniqueIndex("userInterests_user_interest_unique").on(
      table.userId,
      table.interestId,
    ),
  }),
);

export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = typeof userInterests.$inferInsert;

/**
 * Additional profile photos
 */
export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    photoUrl: text("photoUrl").notNull(),
    displayOrder: integer("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("photos_userId_idx").on(table.userId),
  }),
);

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

/**
 * User interactions (likes and comments on prompts)
 */
export const interactions = pgTable(
  "interactions",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("fromUserId").notNull(),
    toUserId: integer("toUserId").notNull(),
    userPromptId: integer("userPromptId"),
    type: interactionTypeEnum("type").notNull(),
    comment: text("comment"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    fromUserIdIdx: index("interactions_fromUserId_idx").on(table.fromUserId),
    toUserIdIdx: index("interactions_toUserId_idx").on(table.toUserId),
    uniqueInteraction: uniqueIndex("interactions_unique_interaction").on(
      table.fromUserId,
      table.toUserId,
      table.userPromptId,
      table.type,
    ),
  }),
);

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

/**
 * Matches between users (created when both users like/comment each other)
 */
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    user1Id: integer("user1Id").notNull(),
    user2Id: integer("user2Id").notNull(),
    matchedAt: timestamp("matchedAt").defaultNow().notNull(),
    isActive: boolean("isActive").default(true).notNull(),
  },
  (table) => ({
    user1IdIdx: index("matches_user1Id_idx").on(table.user1Id),
    user2IdIdx: index("matches_user2Id_idx").on(table.user2Id),
    uniqueMatch: uniqueIndex("matches_unique_match").on(
      table.user1Id,
      table.user2Id,
    ),
  }),
);

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Chat messages between matched users
 */
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    matchId: integer("matchId").notNull(),
    senderId: integer("senderId").notNull(),
    receiverId: integer("receiverId").notNull(),
    content: text("content").notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    matchIdIdx: index("messages_matchId_idx").on(table.matchId),
    senderIdIdx: index("messages_senderId_idx").on(table.senderId),
    receiverIdIdx: index("messages_receiverId_idx").on(table.receiverId),
  }),
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * User reports for safety
 */
export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporterId").notNull(),
    reportedUserId: integer("reportedUserId").notNull(),
    reason: text("reason").notNull(),
    status: reportStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    reporterIdIdx: index("reports_reporterId_idx").on(table.reporterId),
    reportedUserIdIdx: index("reports_reportedUserId_idx").on(
      table.reportedUserId,
    ),
  }),
);

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Blocked users
 */
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blockerId").notNull(),
    blockedUserId: integer("blockedUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    blockerIdIdx: index("blocks_blockerId_idx").on(table.blockerId),
    blockedUserIdIdx: index("blocks_blockedUserId_idx").on(
      table.blockedUserId,
    ),
    uniqueBlock: uniqueIndex("blocks_unique_block").on(
      table.blockerId,
      table.blockedUserId,
    ),
  }),
);

export type Block = typeof blocks.$inferSelect;
export type InsertBlock = typeof blocks.$inferInsert;

/**
 * In-app notifications
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    type: notificationTypeEnum("type").notNull(),
    relatedUserId: integer("relatedUserId"),
    relatedMatchId: integer("relatedMatchId"),
    content: text("content").notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("notifications_userId_idx").on(table.userId),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
