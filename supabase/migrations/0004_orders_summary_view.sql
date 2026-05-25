-- ============================================================
--  KADH Collective — orders_summary view
--  Migration: 0004
--
--  Creates a lightweight summary view used by the admin
--  dashboard stats cards (today's orders, revenue, etc.)
--
--  Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE VIEW orders_summary AS
SELECT
  -- Today's orders (MYT = UTC+8)
  COUNT(*) FILTER (
    WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur')
      AND created_at <  (CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur' + INTERVAL '1 day')
  ) AS orders_today,

  -- Orders by status
  COUNT(*) FILTER (WHERE status = 'confirmed')                          AS confirmed_orders,
  COUNT(*) FILTER (WHERE status IN ('shipped','delivered'))             AS shipped_orders,
  COUNT(*) FILTER (WHERE status = 'flagged')                           AS flagged_orders,

  -- Revenue this calendar month (paid orders only)
  COALESCE(SUM(total) FILTER (
    WHERE status = 'paid'
      AND DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Kuala_Lumpur')
        = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')
  ), 0) AS revenue_this_month,

  -- All-time totals
  COUNT(*)                                                               AS total_orders,
  COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0)               AS total_revenue

FROM orders;

-- Allow authenticated users (admin) to read this view
GRANT SELECT ON orders_summary TO authenticated;
