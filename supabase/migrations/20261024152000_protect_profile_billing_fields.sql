-- Prevent authenticated clients from modifying billing entitlements via permissive profile UPDATE RLS.
-- Service-role Stripe webhooks remain able to update these fields.
CREATE OR REPLACE FUNCTION public.protect_profile_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND (
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
  ) THEN
    RAISE EXCEPTION 'Billing fields may only be changed by the billing service'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing_fields ON public.profiles;
CREATE TRIGGER protect_profile_billing_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing_fields();

REVOKE EXECUTE ON FUNCTION public.protect_profile_billing_fields() FROM PUBLIC, anon, authenticated;
