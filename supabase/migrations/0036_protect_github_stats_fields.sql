CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent authenticated web clients from modifying sensitive fields
  IF current_user = 'authenticated' OR current_user = 'anon' THEN
    NEW.xp := OLD.xp;
    NEW.level := OLD.level;
    NEW.role := OLD.role;
    NEW.audit_completed := OLD.audit_completed;
    NEW.github_handle := OLD.github_handle;
    NEW.github_id := OLD.github_id;
    NEW.github_total_merges := OLD.github_total_merges;
    NEW.github_streak := OLD.github_streak;
    NEW.github_stats_synced_at := OLD.github_stats_synced_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
