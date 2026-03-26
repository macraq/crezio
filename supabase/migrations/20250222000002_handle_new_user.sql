-- =============================================================================
-- Trigger: przy rejestracji (INSERT do auth.users) tworzenie wiersza w public.profiles
-- Metadane (account_type, terms_accepted_at, privacy_accepted_at) z options.data w signUp
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, account_type, terms_accepted_at, privacy_accepted_at, locale)
  VALUES (
    new.id,
    COALESCE((new.raw_user_meta_data->>'account_type')::public.account_type, 'influencer'),
    COALESCE((new.raw_user_meta_data->>'terms_accepted_at')::timestamptz, now()),
    COALESCE((new.raw_user_meta_data->>'privacy_accepted_at')::timestamptz, now()),
    COALESCE(new.raw_user_meta_data->>'locale', 'pl')
  );
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
