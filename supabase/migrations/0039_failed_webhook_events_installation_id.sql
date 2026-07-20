-- Add installation_id to failed_webhook_events so queries can be scoped
-- to a single installation instead of loading cross-org payloads.

ALTER TABLE failed_webhook_events
  ADD COLUMN installation_id bigint REFERENCES github_installations(id);

-- Backfill from the JSONB payload where possible.
-- Dead-letter rows store originalEvent.data which wraps the GitHub payload:
--   { deliveryId, eventType, payload: { installation: { id } } }
-- so we must check both the nested and direct shapes.
UPDATE failed_webhook_events fwe
SET installation_id = COALESCE(
  (fwe.payload->'payload'->'installation'->>'id')::bigint,
  (fwe.payload->'installation'->>'id')::bigint
)
WHERE fwe.installation_id IS NULL
  AND (fwe.payload->'payload'->'installation'->>'id' IS NOT NULL
       OR fwe.payload->'installation'->>'id' IS NOT NULL);

CREATE INDEX IF NOT EXISTS failed_webhook_events_installation_idx
  ON failed_webhook_events (installation_id);
