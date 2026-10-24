-- Consume a rate-limit slot atomically: concurrent requests for the same key
-- must never both pass the same count check without recording a slot.
-- This RPC is service-role only; all anonymous/authenticated callers are denied.
CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_action text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_used integer;
BEGIN
  IF p_action IS NULL OR length(p_action) NOT BETWEEN 1 AND 128
     OR p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 128
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 2678400 THEN
    RAISE EXCEPTION 'Invalid rate-limit configuration';
  END IF;

  -- Transaction-scoped lock serializes checks of the same action and key.
  -- Hash collisions can only over-serialize unrelated keys, not grant access.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_key, 0));

  SELECT count(*)::integer INTO v_used
  FROM public.security_rate_limits r
  WHERE r.action = p_action AND r.key = p_key
    AND r.created_at >= v_now - make_interval(secs => p_window_seconds);

  IF v_used >= p_limit THEN
    RETURN QUERY SELECT false, 0, p_window_seconds;
    RETURN;
  END IF;

  INSERT INTO public.security_rate_limits(action, key, success, created_at)
  VALUES (p_action, p_key, true, v_now);

  RETURN QUERY SELECT true, GREATEST(0, p_limit - v_used - 1), 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  TO service_role;
