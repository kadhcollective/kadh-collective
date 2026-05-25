-- ============================================================
--  KADH Collective — product-images Storage Bucket
--  Migration: 0005
--
--  Creates the `product-images` bucket (public) and sets RLS
--  policies so that:
--    • Anyone can read/view images (storefront + admin preview)
--    • Only authenticated users (admin) can upload/delete
--
--  Idempotent — safe to re-run.
-- ============================================================

-- 1. Create bucket if it doesn't exist, ensure it is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,   -- 5 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. Drop any existing policies on this bucket to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "product-images: public read"          ON storage.objects;
  DROP POLICY IF EXISTS "product-images: authenticated upload" ON storage.objects;
  DROP POLICY IF EXISTS "product-images: authenticated delete" ON storage.objects;
  DROP POLICY IF EXISTS "product-images: authenticated update" ON storage.objects;
END $$;


-- 3. Public read — anyone (incl. storefront visitors) can view images
CREATE POLICY "product-images: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');


-- 4. Authenticated upload — only logged-in admin can add images
CREATE POLICY "product-images: authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');


-- 5. Authenticated update — allow re-uploading / replacing
CREATE POLICY "product-images: authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');


-- 6. Authenticated delete — only admin can remove images
CREATE POLICY "product-images: authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
