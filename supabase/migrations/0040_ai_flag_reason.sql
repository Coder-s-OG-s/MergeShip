-- Add ai_flag_reason column to store the detection category when a PR is AI-flagged.
-- Nullable: only populated when ai_flagged = true.
-- Valid values: 'large_diff', 'generated_msg', 'new_account', 'suspicious_ip'
ALTER TABLE "pull_requests" ADD COLUMN "ai_flag_reason" text;
