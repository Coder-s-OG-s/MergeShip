-- failed_webhook_events is a service-role-only dead letter queue.
-- Enabling RLS without public policies blocks anon/authenticated clients by default.
ALTER TABLE failed_webhook_events ENABLE ROW LEVEL SECURITY;
