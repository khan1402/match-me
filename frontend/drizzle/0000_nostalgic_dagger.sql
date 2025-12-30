CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'non-binary', 'other', 'prefer-not-to-say');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('like', 'comment', 'pass');--> statement-breakpoint
CREATE TYPE "public"."interest_category" AS ENUM('hobbies', 'music', 'food', 'lifestyle', 'sports', 'entertainment', 'travel', 'other');--> statement-breakpoint
CREATE TYPE "public"."lookingFor" AS ENUM('male', 'female', 'non-binary', 'everyone');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('match', 'message', 'like', 'comment');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blockerId" integer NOT NULL,
	"blockedUserId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromUserId" integer NOT NULL,
	"toUserId" integer NOT NULL,
	"userPromptId" integer,
	"type" "interaction_type" NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" "interest_category" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "interests_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user1Id" integer NOT NULL,
	"user2Id" integer NOT NULL,
	"matchedAt" timestamp DEFAULT now() NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"matchId" integer NOT NULL,
	"senderId" integer NOT NULL,
	"receiverId" integer NOT NULL,
	"content" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"relatedUserId" integer,
	"relatedMatchId" integer,
	"content" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"photoUrl" text NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"username" varchar(100),
	"firstName" varchar(100),
	"lastName" varchar(100),
	"age" integer,
	"gender" "gender",
	"lookingFor" "lookingFor",
	"bio" text,
	"location" varchar(255),
	"latitude" real,
	"longitude" real,
	"profilePhotoUrl" text,
	"isProfileComplete" boolean DEFAULT false NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"category" varchar(100),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporterId" integer NOT NULL,
	"reportedUserId" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userInterests" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"interestId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userPrompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"promptId" integer NOT NULL,
	"answer" text NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "blocks_blockerId_idx" ON "blocks" USING btree ("blockerId");--> statement-breakpoint
CREATE INDEX "blocks_blockedUserId_idx" ON "blocks" USING btree ("blockedUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_unique_block" ON "blocks" USING btree ("blockerId","blockedUserId");--> statement-breakpoint
CREATE INDEX "interactions_fromUserId_idx" ON "interactions" USING btree ("fromUserId");--> statement-breakpoint
CREATE INDEX "interactions_toUserId_idx" ON "interactions" USING btree ("toUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_unique_interaction" ON "interactions" USING btree ("fromUserId","toUserId","userPromptId","type");--> statement-breakpoint
CREATE INDEX "matches_user1Id_idx" ON "matches" USING btree ("user1Id");--> statement-breakpoint
CREATE INDEX "matches_user2Id_idx" ON "matches" USING btree ("user2Id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_unique_match" ON "matches" USING btree ("user1Id","user2Id");--> statement-breakpoint
CREATE INDEX "messages_matchId_idx" ON "messages" USING btree ("matchId");--> statement-breakpoint
CREATE INDEX "messages_senderId_idx" ON "messages" USING btree ("senderId");--> statement-breakpoint
CREATE INDEX "messages_receiverId_idx" ON "messages" USING btree ("receiverId");--> statement-breakpoint
CREATE INDEX "notifications_userId_idx" ON "notifications" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "photos_userId_idx" ON "photos" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "profiles_userId_idx" ON "profiles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "reports_reporterId_idx" ON "reports" USING btree ("reporterId");--> statement-breakpoint
CREATE INDEX "reports_reportedUserId_idx" ON "reports" USING btree ("reportedUserId");--> statement-breakpoint
CREATE INDEX "userInterests_userId_idx" ON "userInterests" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "userInterests_user_interest_unique" ON "userInterests" USING btree ("userId","interestId");--> statement-breakpoint
CREATE INDEX "userPrompts_userId_idx" ON "userPrompts" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "userPrompts_user_prompt_unique" ON "userPrompts" USING btree ("userId","promptId");