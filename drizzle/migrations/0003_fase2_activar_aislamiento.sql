-- Fase 2 de seguridad (parte 2): activa el aislamiento por usuario.
--
-- A partir de aquí cada perfil solo ve y modifica sus propios datos, y hace
-- falta haber iniciado sesión para usar la app.
--
-- VUELTA ATRÁS DE EMERGENCIA: si algo deja de funcionar, una migración con
--   update public.security_config set owner_rls_enforced = false;
-- devuelve el comportamiento anterior al instante, sin tocar datos.

update public.security_config set owner_rls_enforced = true;

-- Las funciones de PIN ya solo se usan con sesión iniciada.
revoke execute on function public.verify_profile_pin(uuid, text) from anon;
revoke execute on function public.change_profile_pin(uuid, text, text) from anon;
revoke execute on function public.delete_own_profile(uuid, text) from anon;