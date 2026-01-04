# Identity Mismatch Bug - Root Cause & Fixes

## Root Cause Identified

The identity mismatch bug for seeded users was caused by **two critical issues**:

### 1. Seed Script Bug (PRIMARY CAUSE)
**Location:** `web/backend/cmd/seed/main.go`

**Problem:** The seed script used the loop index `i` instead of `userID` when generating:
- Photo URLs: `fmt.Sprintf("https://picsum.photos/seed/user%d-photo%d/600/600", i, j)`
- Profile photo URLs: `portraitIndex := (i % 99) + 1`

**Why this breaks:**
- When a user already exists (e.g., user5), the script skips creation but continues with `i=5`
- Photos are created with seed "user5" but `user_id = actual_userID` (which might be different)
- This causes photos to be associated with wrong users

**Fix:** Changed all photo/profile photo generation to use `userID` instead of `i`

### 2. Backend Query Bug (SECONDARY CAUSE)
**Location:** `web/backend/db/interactions.go`

**Problem:** Queries used `profile_photo_url` from profiles table instead of photos table:
- `GetMyLikes()` - used `p.profile_photo_url`
- `GetIncomingRequests()` - used `p.profile_photo_url`
- `GetMyMatches()` - used `other_p.profile_photo_url`

**Why this breaks:**
- `profile_photo_url` might be stale or wrong
- Photos table has the actual photos with deterministic ordering
- Frontend uses photos table, backend used profiles table → mismatch

**Fix:** Changed all queries to use photos table with deterministic ordering:
```sql
COALESCE(
  (SELECT photo_url FROM photos 
   WHERE user_id = u.id 
   ORDER BY sort_order ASC, created_at ASC 
   LIMIT 1),
  p.profile_photo_url,
  ''
) AS photo_url
```

## Fixes Applied

### ✅ Backend Seed Script (`web/backend/cmd/seed/main.go`)
- Fixed photo URL generation to use `userID` instead of `i`
- Fixed profile photo URL generation to use `userID` instead of `i`
- Added validation comments

### ✅ Backend Queries (`web/backend/db/interactions.go`)
- Fixed `GetMyLikes()` to use photos table with deterministic ordering
- Fixed `GetIncomingRequests()` to use photos table with deterministic ordering
- Fixed `GetMyMatches()` to use photos table with deterministic ordering

### ✅ Database Constraints (`web/db/migrations/000007_add_foreign_keys.up.sql`)
- Added foreign key constraints to prevent orphaned records
- Ensures `profiles.user_id` references `users.id`
- Ensures `photos.user_id` references `users.id`
- Added constraints for all related tables

### ✅ Frontend Validation (Already applied in previous fix)
- Added ID validation in ProfileHub.tsx
- Added ID validation in Profile.tsx
- Added ID validation in backend db.ts functions

### ✅ Diagnostic Tools
- Created `web/db/diagnostic_queries.sql` - SQL queries to find data issues
- Created `web/db/verify_data_integrity.sql` - Script to verify and fix existing data

## Next Steps

1. **Run the migration** to add foreign key constraints:
   ```bash
   # Apply migration
   migrate -path web/db/migrations -database $DATABASE_URL up
   ```

2. **Verify existing data** (if you have seeded users):
   ```bash
   # Run diagnostic queries
   psql $DATABASE_URL -f web/db/diagnostic_queries.sql
   ```

3. **Fix existing data** (if needed):
   ```bash
   # Review and run fix queries (uncomment in verify_data_integrity.sql)
   psql $DATABASE_URL -f web/db/verify_data_integrity.sql
   ```

4. **Re-seed users** (recommended):
   ```bash
   # Re-run seed script to fix existing seeded users
   go run web/backend/cmd/seed/main.go
   ```

## Verification

After fixes, verify:
- ✅ All photos have correct `user_id` matching their user
- ✅ All profiles have correct `user_id` matching their user
- ✅ No duplicate `sort_order` per user in photos table
- ✅ `profile_photo_url` matches first photo from photos table for each user
- ✅ Discovery → Likes → View Profile shows consistent user data

## Prevention

The foreign key constraints will prevent future data integrity issues. The seed script fix ensures new seeded users are created correctly.

