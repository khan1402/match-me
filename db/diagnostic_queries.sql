-- Diagnostic queries to find data integrity issues
-- Run these to identify mismatched or orphaned data

-- 1. Find profiles with invalid user_id (orphaned profiles)
SELECT p.id, p.user_id, p.first_name
FROM profiles p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- 2. Find users without profiles
SELECT u.id, u.email, u.name
FROM users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

-- 3. Find photos with invalid user_id (orphaned photos)
SELECT ph.id, ph.user_id, ph.photo_url
FROM photos ph
LEFT JOIN users u ON ph.user_id = u.id
WHERE u.id IS NULL;

-- 4. Find users with multiple profiles (should never happen due to UNIQUE constraint)
SELECT user_id, COUNT(*) as profile_count
FROM profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 5. Find profiles where profile.user_id doesn't match profile.id (if id was incorrectly used)
-- This shouldn't happen, but checking anyway
SELECT p.id, p.user_id, 
       CASE WHEN p.id != p.user_id THEN 'MISMATCH' ELSE 'OK' END as status
FROM profiles p
WHERE p.id != p.user_id;

-- 6. Find photos where photo.user_id doesn't match the user who owns the profile_photo_url
-- This checks if profile_photo_url points to a photo from a different user
SELECT p.id as profile_id, p.user_id as profile_user_id, p.profile_photo_url,
       ph.id as photo_id, ph.user_id as photo_user_id, ph.photo_url,
       CASE WHEN p.user_id != ph.user_id THEN 'MISMATCH' ELSE 'OK' END as status
FROM profiles p
JOIN photos ph ON p.profile_photo_url = ph.photo_url
WHERE p.user_id != ph.user_id;

-- 7. Find users with photos that have wrong user_id
-- Compare photos.user_id with the user they should belong to
SELECT DISTINCT ph.user_id as photo_user_id, 
       COUNT(*) as photo_count,
       STRING_AGG(DISTINCT u.id::text, ', ') as actual_user_ids
FROM photos ph
JOIN users u ON u.id = ph.user_id
GROUP BY ph.user_id
HAVING COUNT(DISTINCT u.id) > 1;

-- 8. Find interactions with invalid user references
SELECT i.id, i.user_id, i.target_user_id,
       CASE WHEN u1.id IS NULL THEN 'INVALID user_id' ELSE 'OK' END as user_id_status,
       CASE WHEN u2.id IS NULL THEN 'INVALID target_user_id' ELSE 'OK' END as target_user_id_status
FROM interactions i
LEFT JOIN users u1 ON i.user_id = u1.id
LEFT JOIN users u2 ON i.target_user_id = u2.id
WHERE u1.id IS NULL OR u2.id IS NULL;

-- 9. Find user_interests with invalid references
SELECT ui.id, ui.user_id, ui.interest_id,
       CASE WHEN u.id IS NULL THEN 'INVALID user_id' ELSE 'OK' END as user_status,
       CASE WHEN i.id IS NULL THEN 'INVALID interest_id' ELSE 'OK' END as interest_status
FROM user_interests ui
LEFT JOIN users u ON ui.user_id = u.id
LEFT JOIN interests i ON ui.interest_id = i.id
WHERE u.id IS NULL OR i.id IS NULL;

-- 10. Find user_prompts with invalid references
SELECT up.id, up.user_id, up.prompt_id,
       CASE WHEN u.id IS NULL THEN 'INVALID user_id' ELSE 'OK' END as user_status,
       CASE WHEN p.id IS NULL THEN 'INVALID prompt_id' ELSE 'OK' END as prompt_status
FROM user_prompts up
LEFT JOIN users u ON up.user_id = u.id
LEFT JOIN prompts p ON up.prompt_id = p.id
WHERE u.id IS NULL OR p.id IS NULL;

-- 11. Check for non-deterministic photo ordering (multiple photos with same sort_order)
SELECT user_id, sort_order, COUNT(*) as count
FROM photos
GROUP BY user_id, sort_order
HAVING COUNT(*) > 1
ORDER BY user_id, sort_order;

-- 12. Summary: Count of potential issues
SELECT 
    (SELECT COUNT(*) FROM profiles p LEFT JOIN users u ON p.user_id = u.id WHERE u.id IS NULL) as orphaned_profiles,
    (SELECT COUNT(*) FROM photos ph LEFT JOIN users u ON ph.user_id = u.id WHERE u.id IS NULL) as orphaned_photos,
    (SELECT COUNT(*) FROM profiles p JOIN photos ph ON p.profile_photo_url = ph.photo_url WHERE p.user_id != ph.user_id) as profile_photo_mismatches,
    (SELECT COUNT(*) FROM (SELECT user_id, sort_order, COUNT(*) FROM photos GROUP BY user_id, sort_order HAVING COUNT(*) > 1) x) as non_deterministic_photo_orders;

