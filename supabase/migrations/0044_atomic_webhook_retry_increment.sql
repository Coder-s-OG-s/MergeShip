-- Fix for issue #785: Concurrent webhook retries bypass retry limit
-- This function atomically increments the retry_count only if it's below the max_retries limit.
-- This prevents race conditions where multiple concurrent retry requests both pass the
-- retry limit check before incrementing, causing the same webhook to be dispatched multiple times.

CREATE OR REPLACE FUNCTION increment_webhook_retry_count(event_id bigint, max_retries integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT retry_count INTO current_count
  FROM failed_webhook_events
  WHERE id = event_id
  FOR UPDATE;

  -- If the event doesn't exist or retry limit is exceeded, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_count >= max_retries THEN
    RETURN false;
  END IF;

  -- Increment the retry count
  UPDATE failed_webhook_events
  SET retry_count = retry_count + 1
  WHERE id = event_id;

  RETURN true;
END;
$$;
