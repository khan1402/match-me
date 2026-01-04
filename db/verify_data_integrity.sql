-- Data Integrity Verification Script
-- Run this to check for and fix data mismatches in seeded users

-- ============================================
-- 1. FIND AND REPORT ISSUES
-- ============================================

-- Orphaned profiles (profiles.user_id doesn't exist in users)
SELECT 'ORPHANED PROFILES' as issue_type, COUNT(*) as count
FROM profiles p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- Orphaned photos (photos.user_id doesn't exist in users)
SELECT 'ORPHANED PHOTOS' as issue_type, COUNT(*) as count
FROM photos ph
LEFT JOIN users u ON ph.user_id = u.id
WHERE u.id IS NULL;

-- Photos with wrong user_id (photos.user_id doesn't match the user they should belong to)
-- This is harder to detect automatically, but we can check for duplicates
SELECT 'DUPLICATE SORT_ORDER' as issue_type, user_id, sort_order, COUNT(*) as count
FROM photos
GROUP BY user_id, sort_order
HAVING COUNT(*) > 1;

-- Profiles where profile_photo_url points to a photo from a different user
SELECT 'PROFILE_PHOTO_MISMATCH' as issue_type, COUNT(*) as count
FROM profiles p
JOIN photos ph ON p.profile_photo_url = ph.photo_url
WHERE p.user_id != ph.user_id;

-- ============================================
-- 2. FIX ISSUES (CAREFUL - BACKUP FIRST!)
-- ============================================

-- Delete orphaned profiles
-- DELETE FROM profiles WHERE user_id NOT IN (SELECT id FROM users);

-- Delete orphaned photos
-- DELETE FROM photos WHERE user_id NOT IN (SELECT id FROM users);

-- Fix profile_photo_url mismatches by setting it to the first photo from photos table
-- UPDATE profiles p
-- SET profile_photo_url = (
--   SELECT photo_url FROM photos ph
--   WHERE ph.user_id = p.user_id
--   ORDER BY sort_order ASC, created_at ASC
--   LIMIT 1
-- )
-- WHERE EXISTS (
--   SELECT 1 FROM photos ph
--   WHERE ph.user_id = p.user_id
-- );

-- ============================================
-- 3. VERIFY FIXES
-- ============================================

-- After fixes, verify all profiles have valid user_id
SELECT 'VERIFY: All profiles have valid users' as check_name,
       COUNT(*) as orphaned_count
FROM profiles p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- Verify all photos have valid user_id
SELECT 'VERIFY: All photos have valid users' as check_name,
       COUNT(*) as orphaned_count
FROM photos ph
LEFT JOIN users u ON ph.user_id = u.id
WHERE u.id IS NULL;

-- Verify no duplicate sort_order per user
SELECT 'VERIFY: No duplicate sort_order' as check_name,
       COUNT(*) as duplicate_count
FROM (
  SELECT user_id, sort_order, COUNT(*) as cnt
  FROM photos
  GROUP BY user_id, sort_order
  HAVING COUNT(*) > 1
) duplicates;

