CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.claim_profile(_profile_id uuid, _pin_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); linked uuid; ok boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO linked FROM public.profiles WHERE auth_user_id = uid;
  IF linked IS NOT NULL THEN RETURN linked = _profile_id; END IF;
  UPDATE public.profiles SET auth_user_id = uid
   WHERE id = _profile_id AND pin_hash = _pin_hash AND auth_user_id IS NULL;
  ok := FOUND;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION public.create_linked_profile(_name text, _pin_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); linked uuid; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO linked FROM public.profiles WHERE auth_user_id = uid;
  IF linked IS NOT NULL THEN RETURN linked; END IF;
  INSERT INTO public.profiles (name, pin_hash, auth_user_id)
  VALUES (btrim(_name), _pin_hash, uid)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.my_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_profile(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_linked_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_linked_profile(text, text) TO authenticated;

UPDATE public.security_config SET owner_rls_enforced = true, updated_at = now();