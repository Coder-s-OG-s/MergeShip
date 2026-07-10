CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent authenticated web clients from modifying sensitive fields
  IF current_user = 'authenticated' OR current_user = 'anon' THEN
    NEW.xp := OLD.xp;
    NEW.level := OLD.level;
    NEW.role := OLD.role;
    NEW.audit_completed := OLD.audit_completed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_profile_fields_protected ON profiles;
CREATE TRIGGER ensure_profile_fields_protected
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_sensitive_fields();
