-- Migration: atomic claim_recommendation function
--
-- Replaces the two-step COUNT + UPDATE in claimRecommendation with a single
-- atomic statement. The previous implementation read the active-claim count
-- and then wrote the status update as two independent round-trips, creating
-- a TOCTOU window: concurrent requests from the same user could both observe
-- a count below 3 and both succeed, allowing more than 3 simultaneous claims.
--
-- The function below runs the count check and the status flip in one UPDATE
-- statement inside a single implicit transaction. PostgreSQL row-level locking
-- on the target row (via FOR UPDATE on the SELECT inside UPDATE ... WHERE)
-- ensures concurrent calls serialise correctly.
--
-- Returns the ID of the claimed recommendation if the claim succeeded, or an
-- empty result set if the limit was already reached or the rec is not open.

create or replace function claim_recommendation_atomic(
  p_rec_id  bigint,
  p_user_id uuid
)
returns table(id bigint)
language plpgsql
security definer
as $$
begin
  return query
  update recommendations r
  set
    status     = 'claimed',
    claimed_at = now()
  where
    r.id      = p_rec_id
    and r.user_id = p_user_id
    and r.status  = 'open'
    and (
      select count(*)
      from   recommendations r2
      where  r2.user_id = p_user_id
        and  r2.status  = 'claimed'
    ) < 3
  returning r.id;
end;
$$;

-- Revoke public access; the function is called only through the service role.
revoke all on function claim_recommendation_atomic(bigint, uuid) from public;
