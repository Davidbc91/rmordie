-- Apariencia: cada usuario elige el color principal y el fondo de la app.
-- Se guarda en su fila de app_settings (ya protegida: solo el dueño la ve y la cambia).
alter table public.app_settings
  add column if not exists theme jsonb not null default '{}'::jsonb;
