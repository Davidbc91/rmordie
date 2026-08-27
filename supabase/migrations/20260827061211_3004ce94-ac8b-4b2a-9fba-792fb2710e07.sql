-- SOCIAL PROFILES
CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  box_name text,
  level text,
  crossfit_start_date date,
  is_private boolean NOT NULL DEFAULT false,
  show_stats boolean NOT NULL DEFAULT true,
  show_prs boolean NOT NULL DEFAULT true,
  allow_comments boolean NOT NULL DEFAULT true,
  public_exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO authenticated, anon;
GRANT ALL ON public.social_profiles TO service_role;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_profiles open" ON public.social_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER social_profiles_touch BEFORE UPDATE ON public.social_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  caption text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  hashtags text[] NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public',
  is_hidden boolean NOT NULL DEFAULT false,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_created_idx ON public.posts (created_at DESC);
CREATE INDEX posts_user_idx ON public.posts (user_id);
CREATE INDEX posts_kind_idx ON public.posts (kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated, anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts open" ON public.posts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- POST MEDIA
CREATE TABLE public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_media_post_idx ON public.post_media (post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated, anon;
GRANT ALL ON public.post_media TO service_role;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_media open" ON public.post_media FOR ALL USING (true) WITH CHECK (true);

-- LIKES
CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes TO authenticated, anon;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_likes open" ON public.post_likes FOR ALL USING (true) WITH CHECK (true);

-- COMMENTS
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_comments_post_idx ON public.post_comments (post_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated, anon;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_comments open" ON public.post_comments FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated, anon;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes open" ON public.comment_likes FOR ALL USING (true) WITH CHECK (true);

-- SAVED
CREATE TABLE public.saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_posts TO authenticated, anon;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_posts open" ON public.saved_posts FOR ALL USING (true) WITH CHECK (true);

-- FOLLOWS
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated, anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows open" ON public.follows FOR ALL USING (true) WITH CHECK (true);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, anon;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications open" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- REPORTS
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  reported_user_id uuid,
  reason text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated, anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports open" ON public.reports FOR ALL USING (true) WITH CHECK (true);

-- BLOCKS
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_users TO authenticated, anon;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_users open" ON public.blocked_users FOR ALL USING (true) WITH CHECK (true);

-- COUNTER TRIGGERS
CREATE OR REPLACE FUNCTION public.sync_post_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta integer;
BEGIN
  delta := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  IF TG_TABLE_NAME = 'post_likes' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, likes_count + delta)
      WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count + delta)
      WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSIF TG_TABLE_NAME = 'saved_posts' THEN
    UPDATE public.posts SET saves_count = GREATEST(0, saves_count + delta)
      WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSIF TG_TABLE_NAME = 'comment_likes' THEN
    UPDATE public.post_comments SET likes_count = GREATEST(0, likes_count + delta)
      WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER post_likes_counter AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();
CREATE TRIGGER post_comments_counter AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();
CREATE TRIGGER saved_posts_counter AFTER INSERT OR DELETE ON public.saved_posts FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();
CREATE TRIGGER comment_likes_counter AFTER INSERT OR DELETE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();