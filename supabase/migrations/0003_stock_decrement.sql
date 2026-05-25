-- ============================================================
--  Phase 7-Op-B: Stop overselling
--
--  1. Ensure stock_alerts table exists (admin already references it
--     in the dashboard).
--  2. Add decrement_product_stock(p_id, p_qty) Postgres function
--     called from stripe-webhook after a successful payment.
--
--  Idempotent — safe to re-run.
-- ============================================================

-- 1. STOCK ALERTS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_alerts (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT REFERENCES products(id) ON DELETE CASCADE,
  stock_count INT,
  threshold   INT,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full" ON stock_alerts;
CREATE POLICY "authenticated full" ON stock_alerts
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 2. STOCK DECREMENT FUNCTION ──────────────────────────────────
-- Atomically decrement stock for a product, returning the new stock
-- count and low-stock threshold so the caller can decide whether to
-- create an alert. SECURITY DEFINER so edge fn can call as service.
CREATE OR REPLACE FUNCTION decrement_product_stock(p_id BIGINT, p_qty INT)
RETURNS TABLE(new_stock INT, threshold INT) AS $$
DECLARE
  v_new_stock INT;
  v_threshold INT;
BEGIN
  UPDATE products
  SET    stock_count = GREATEST(0, COALESCE(stock_count, 0) - p_qty)
  WHERE  id = p_id
  RETURNING stock_count, COALESCE(low_stock_threshold, 3)
    INTO v_new_stock, v_threshold;

  IF v_new_stock IS NULL THEN
    RETURN;  -- product not found, return no rows
  END IF;

  -- Auto sold-out flag when count hits zero
  IF v_new_stock = 0 THEN
    UPDATE products SET in_stock = FALSE WHERE id = p_id;
  END IF;

  RETURN QUERY SELECT v_new_stock, v_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decrement_product_stock(BIGINT, INT) TO authenticated, service_role;

-- 3. VERIFY
SELECT 'stock_alerts table' AS check, COUNT(*) AS rows FROM stock_alerts
UNION ALL
SELECT 'decrement_product_stock fn', COUNT(*) FROM pg_proc WHERE proname = 'decrement_product_stock';
