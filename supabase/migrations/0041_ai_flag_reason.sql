-- Add ai_flag_reason column to store the detection category when a PR is AI-flagged.
-- Nullable: only populated when ai_flagged = true.
-- Valid values: 'large_diff', 'generated_msg', 'new_account', 'suspicious_ip'
-- Renumbered from 0040 -> 0041: this file shared the 0040 prefix with
-- 0040_installation_settings_strict_rls.sql, which broke `supabase db reset` for contributors.
ALTER TABLE "pull_requests" ADD COLUMN "ai_flag_reason" text;
