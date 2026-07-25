-- Add installation_id to flagged_accounts to scope flags by installation.
-- Fixes cross-installation privilege escalation (issue #772).

ALTER TABLE "flagged_accounts" ADD COLUMN "installation_id" bigint;

-- Backfill from evidence: each flag's evidence items reference repos that
-- belong to a specific installation. We cannot backfill precisely without
-- a repo→installation mapping, so we leave existing rows NULL and rely on
-- the application to always set installation_id on new flags.

CREATE INDEX IF NOT EXISTS flagged_accounts_installation_idx
  ON flagged_accounts (installation_id);

-- Scope the unique constraint to include installation_id so the same user
-- can have separate open flags per installation.
ALTER TABLE flagged_accounts
  DROP CONSTRAINT IF EXISTS flagged_accounts_user_id_reason_status_key;

ALTER TABLE flagged_accounts
  ADD CONSTRAINT flagged_accounts_user_id_reason_status_key
  UNIQUE (user_id, reason, status, installation_id);
