-- Cierra el aviso de seguridad de Lovable: «Any signed-in user can read every
-- record in security_config».
--
-- La tabla solo guarda el interruptor owner_rls_enforced. Nadie la lee desde
-- la app: la consultan las funciones private.owner_rls_enforced() y
-- public.owner_rls_enforced(), que son SECURITY DEFINER y siguen pudiendo
-- leerla. Se quita el acceso directo de los usuarios.
--
-- No cambia ningún dato ni el aislamiento entre usuarios.

drop policy if exists "security_config readable" on public.security_config;
revoke all on public.security_config from anon, authenticated;
grant all on public.security_config to service_role;
alter table public.security_config enable row level security;