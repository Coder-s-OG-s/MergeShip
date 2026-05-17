CREATE TABLE IF NOT EXISTS failed_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX failed_webhook_delivery_idx 
ON failed_webhook_events (delivery_id);

CREATE INDEX failed_webhook_event_type_idx 
ON failed_webhook_events (event_type);