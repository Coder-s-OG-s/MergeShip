-- Add installation_id to failed_webhook_events so queries can be scoped
-- to a single installation instead of loading cross-org payloads.

ALTER TABLE failed_webhook_events
  ADD COLUMN installation_id bigint REFERENCES github_installations(id);

-- Backfill from the JSONB payload where possible.
UPDATE failed_webhook_events fwe
SET installation_id = (fwe.payload->'installation'->>'id')::bigint
WHERE fwe.payload ? 'installation'
  AND fwe.payload->'installation'->>'id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS failed_webhook_events_installation_idx
  ON failed_webhook_events (installation_id);
