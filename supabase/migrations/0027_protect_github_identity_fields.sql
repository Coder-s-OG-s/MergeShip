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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
