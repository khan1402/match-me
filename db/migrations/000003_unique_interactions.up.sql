CREATE UNIQUE INDEX IF NOT EXISTS uniq_interactions_user_target
ON interactions (user_id, target_user_id);
