-- ============================================================
--  KADH Collective — Phase 5b: Community tables
--  Migration: 0002
--
--  Creates three tables for the Community page:
--    - journal_posts          (Journal/Blog content)
--    - events                 (Past + upcoming gatherings)
--    - newsletter_subscribers (Email signup form)
--
--  Idempotent — safe to re-run.
-- ============================================================

-- 1. JOURNAL POSTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_posts (
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  excerpt      TEXT,
  body         TEXT,
  cover_image  TEXT,
  author       TEXT DEFAULT 'KADH Collective',
  published    BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE journal_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read published" ON journal_posts;
CREATE POLICY "anon read published" ON journal_posts
  FOR SELECT TO anon USING (published = TRUE);

DROP POLICY IF EXISTS "authenticated full" ON journal_posts;
CREATE POLICY "authenticated full" ON journal_posts
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 2. EVENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  event_date   DATE NOT NULL,
  location     TEXT,
  cover_image  TEXT,
  gallery      JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_type   TEXT,
  status       TEXT NOT NULL DEFAULT 'upcoming',  -- upcoming | past | cancelled
  rsvp_url     TEXT,
  published    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read published" ON events;
CREATE POLICY "anon read published" ON events
  FOR SELECT TO anon USING (published = TRUE);

DROP POLICY IF EXISTS "authenticated full" ON events;
CREATE POLICY "authenticated full" ON events
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 3. NEWSLETTER SUBSCRIBERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  source          TEXT,
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon CAN insert (sign up) but CANNOT read (no email harvesting)
DROP POLICY IF EXISTS "anon insert" ON newsletter_subscribers;
CREATE POLICY "anon insert" ON newsletter_subscribers
  FOR INSERT TO anon WITH CHECK (TRUE);

DROP POLICY IF EXISTS "authenticated select" ON newsletter_subscribers;
CREATE POLICY "authenticated select" ON newsletter_subscribers
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "authenticated update" ON newsletter_subscribers;
CREATE POLICY "authenticated update" ON newsletter_subscribers
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "authenticated delete" ON newsletter_subscribers;
CREATE POLICY "authenticated delete" ON newsletter_subscribers
  FOR DELETE TO authenticated USING (TRUE);

-- 4. AUTO-UPDATE updated_at TRIGGERS ──────────────────────────
CREATE OR REPLACE FUNCTION community_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_posts_updated_at ON journal_posts;
CREATE TRIGGER journal_posts_updated_at
  BEFORE UPDATE ON journal_posts
  FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

-- 5. SEED — sample journal post + event so storefront has something to show
INSERT INTO journal_posts (slug, title, excerpt, body, published, published_at)
VALUES (
  'welcome-to-kadh',
  'Welcome to KADH',
  'A note on why we started, and what we hope to build.',
  'KADH started with a question — what would she actually want? Every piece, every gathering, every conversation has come back to that. This is a journal of how we think about the things we make, the women who wear them, and the small joys of building something slowly.',
  TRUE,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO events (title, description, event_date, location, event_type, status, published)
VALUES (
  'KADH Raya Trunk Show',
  'An intimate showing of our Raya 2025 collection. Try pieces, share tea, meet the team.',
  '2025-03-15',
  'Bangsar, Kuala Lumpur',
  'pop-up',
  'past',
  TRUE
)
ON CONFLICT DO NOTHING;

-- 6. VERIFY
SELECT 'journal_posts'          AS table_name, COUNT(*) AS rows FROM journal_posts
UNION ALL
SELECT 'events',                  COUNT(*) FROM events
UNION ALL
SELECT 'newsletter_subscribers', COUNT(*) FROM newsletter_subscribers;
