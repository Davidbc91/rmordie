
CREATE TABLE public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  weight numeric NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO anon, authenticated;
GRANT ALL ON public.personal_records TO service_role;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records open" ON public.personal_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
