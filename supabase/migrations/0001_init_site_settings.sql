-- ============================================================
--  KADH Collective — Phase 1: site_settings extension
--  Migration: 0001 (corrective — handles pre-existing table)
--
--  Background: site_settings already exists with 19 rows of
--  real data (hero copy, WhatsApp, IG handle, etc.) and a
--  TEXT-typed `value` column. This migration:
--    1. Adds is_public + description columns
--    2. Converts value TEXT → JSONB (preserving existing data)
--    3. Sets RLS policies cleanly
--    4. Marks existing keys as public/private appropriately
--    5. Adds new keys we'll need (shipping_zones, currency_rates, etc.)
--
--  Idempotent — safe to re-run. Never overwrites existing values.
-- ============================================================

-- 1. ADD MISSING COLUMNS ─────────────────────────────────────
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. CONVERT value TEXT → JSONB (only if not already JSONB) ─
DO $$
BEGIN
  IF (
    SELECT data_type
    FROM   information_schema.columns
    WHERE  table_name = 'site_settings'
       AND column_name = 'value'
  ) = 'text' THEN
    ALTER TABLE site_settings
      ALTER COLUMN value TYPE JSONB USING to_jsonb(value);
  END IF;
END $$;

-- 3. RLS — drop and re-create policies cleanly ──────────────
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read public settings" ON site_settings;
CREATE POLICY "anon read public settings" ON site_settings
  FOR SELECT TO anon USING (is_public = TRUE);

DROP POLICY IF EXISTS "authenticated full access" ON site_settings;
CREATE POLICY "authenticated full access" ON site_settings
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 4. AUTO-UPDATE updated_at TRIGGER ─────────────────────────
CREATE OR REPLACE FUNCTION site_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION site_settings_set_updated_at();

-- 5. MARK EXISTING KEYS public/private ──────────────────────
-- Public (storefront reads these)
UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Brand name shown in receipts and footer.')
WHERE  key = 'shop_name';

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Canonical site URL.')
WHERE  key = 'shop_url';

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'WhatsApp number — country code + digits.')
WHERE  key IN ('wa_number', 'whatsapp_number');

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Default WA message for customer float button.')
WHERE  key = 'wa_message';

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Hero section copy on landing page.')
WHERE  key IN ('hero_title', 'hero_subtitle', 'hero_eyebrow');

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Announcement bar copy and color.')
WHERE  key IN ('announcement', 'announcement_bar', 'announcement_color');

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Worldwide shipping badge label.')
WHERE  key = 'ships_badge';

UPDATE site_settings SET is_public = TRUE,
       description = COALESCE(description, 'Instagram handle for footer / community.')
WHERE  key = 'instagram_handle';

-- Private (admin-only)
UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'EasyParcel API key (admin only).')
WHERE  key = 'ep_api_key';

UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'EasyParcel integration on/off toggle.')
WHERE  key = 'ep_integration';

UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'Sender email for receipts. Domain must be verified in Resend.')
WHERE  key = 'from_email';

UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'Resend API key (admin only).')
WHERE  key = 'resend_api_key';

UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'WA template admin sends after confirming. Placeholders: {{name}}, {{ref}}, {{total}}.')
WHERE  key = 'wa_confirm_template';

UPDATE site_settings SET is_public = FALSE,
       description = COALESCE(description, 'WA template admin sends after shipping. Placeholders: {{name}}, {{ref}}, {{tracking_no}}.')
WHERE  key = 'wa_shipped_template';

-- 6. INSERT NEW KEYS (skips if already present) ─────────────
INSERT INTO site_settings (key, value, is_public, description) VALUES
  ('shipping_zones',
   $$
   {
     "MY":    [{"name":"Standard (Pos Laju)",         "days":"2–4 business days",   "price":0},
               {"name":"Express (Next Day)",          "days":"Next business day",   "price":15}],
     "SG":    [{"name":"Standard (DHL / FedEx)",      "days":"3–5 business days",   "price":25},
               {"name":"Express",                     "days":"1–2 business days",   "price":55}],
     "ID":    [{"name":"Standard",                    "days":"5–8 business days",   "price":30},
               {"name":"Express",                     "days":"2–3 business days",   "price":65}],
     "GCC":   [{"name":"Standard (Aramex)",           "days":"5–7 business days",   "price":45},
               {"name":"Express (DHL)",               "days":"2–3 business days",   "price":85}],
     "EU":    [{"name":"Standard (DHL)",              "days":"7–10 business days",  "price":60},
               {"name":"Express (DHL)",               "days":"3–5 business days",   "price":110}],
     "US":    [{"name":"Standard (FedEx)",            "days":"7–12 business days",  "price":65},
               {"name":"Express (FedEx)",             "days":"3–5 business days",   "price":120}],
     "AU":    [{"name":"Standard (Australia Post)",   "days":"7–10 business days",  "price":55},
               {"name":"Express (DHL)",               "days":"3–5 business days",   "price":100}],
     "OTHER": [{"name":"International Standard",      "days":"10–14 business days", "price":70},
               {"name":"International Express (DHL)", "days":"5–7 business days",   "price":130}]
   }
   $$::jsonb,
   TRUE,
   'Shipping zones and prices in MYR. Edit in admin Settings.'),

  ('currency_rates',
   '{"MYR":1,"USD":0.22,"AED":0.81,"GBP":0.17,"EUR":0.20,"SGD":0.30,"AUD":0.34,"SAR":0.83}'::jsonb,
   TRUE,
   'FX rates with MYR=1 base. Auto-refreshed daily in Phase 4.'),

  ('currency_rates_updated_at',
   'null'::jsonb,
   TRUE,
   'ISO timestamp of last FX rate refresh.'),

  ('currency_geo_defaults',
   '{"MY":"MYR","SG":"SGD","ID":"MYR","AE":"AED","SA":"SAR","GB":"GBP","US":"USD","AU":"AUD","DE":"EUR","FR":"EUR","NL":"EUR","IT":"EUR","ES":"EUR","default":"USD"}'::jsonb,
   TRUE,
   'Auto-select currency by visitor country.'),

  ('bnpl_enabled',
   'false'::jsonb,
   TRUE,
   'Show BNPL tab on checkout. Set TRUE in Phase 7 (Atome / Grab PayLater).'),

  ('stripe_publishable_key',
   '""'::jsonb,
   TRUE,
   'Stripe publishable key (pk_test_/pk_live_). Public-safe. Set in Phase 3.'),

  ('ep_sandbox',
   '"true"'::jsonb,
   FALSE,
   'EasyParcel sandbox mode. Set "false" once live shipping is verified.')
ON CONFLICT (key) DO NOTHING;

-- 7. VERIFY ──────────────────────────────────────────────────
SELECT key,
       is_public,
       jsonb_typeof(value) AS value_type,
       LEFT(description, 50) AS description
FROM   site_settings
ORDER  BY is_public DESC, key;
