-- Migration: atomic claim function to close TOCTOU race condition (issue #205)
--
-- The previous TypeScript implementation enforced the 3-claim cap with a COUNT
-- query followed by a separate UPDATE. Because these are two independent database
-- round-trips, concurrent requests for the same user can both read count < 3,
-- both pass the guard, and both commit, allowing a user to exceed 3 active claims.
--
-- This function moves both operations into a single UPDATE statement. The
-- subquery that checks the count and the row that gets written are evaluated
-- atomically by the database engine, so concurrent calls are serialised at
-- the row level. If the count is already 3 when the UPDATE runs, zero rows
-- are returned and the claim is rejected without a separate round-trip.

CREATE OR REPLACE FUNCTION public.claim_recommendation_atomic(
  p_rec_id  bigint,
  p_user_id uuid
)
RETURNS TABLE(id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE recommendations AS r
  SET
    status     = 'claimed',
    claimed_at = now()
  WHERE
    r.id      = p_rec_id
    AND r.user_id = p_user_id
    AND r.status  = 'open'
    AND (
      SELECT COUNT(*)
      FROM   recommendations r2
      WHERE  r2.user_id = p_user_id
        AND  r2.status  = 'claimed'
    ) < 3
  RETURNING r.id;
END;
$$;

-- Grant execute to authenticated users (server actions run under their session)
-- and to the service role (used by Inngest functions and webhook handlers).
GRANT EXECUTE ON FUNCTION public.claim_recommendation_atomic(bigint, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_recommendation_atomic(bigint, uuid)
  TO service_role;
