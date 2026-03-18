-- our 3 special queries
-- =========================
-- SPECIAL QUERIES (Required)
-- =========================

-- 1) Weekly Sales History: count of orders and revenue grouped by week
SELECT
  date_trunc('week', transactiontime)::date AS week_start,
  COUNT(*) AS orders,
  SUM(totalamount) AS revenue
FROM transactions
WHERE status='completed'
GROUP BY 1
ORDER BY 1;

-- 2) Realistic Sales History: count of orders and revenue grouped by hour
SELECT
  EXTRACT(HOUR FROM transactiontime)::int AS hour_of_day,
  COUNT(*) AS orders,
  SUM(totalamount) AS revenue
FROM transactions
WHERE status='completed'
GROUP BY 1
ORDER BY 1;

-- 3) Peak Sales Day: top 10 days by revenue
SELECT
  transactiontime::date AS day,
  SUM(totalamount) AS revenue,
  COUNT(*) AS orders
FROM transactions
WHERE status='completed'
GROUP BY 1
ORDER BY revenue DESC
LIMIT 10;

-- 4) Menu Item Inventory: count of inventory items (ingredients) grouped by menu item
SELECT
  p.name AS menu_item,
  COUNT(pi.inventoryid) AS ingredient_count
FROM product p
JOIN productingredient pi ON pi.productid = p.productid
GROUP BY p.productid, p.name
ORDER BY ingredient_count DESC, menu_item;

-- 5) Best of the Worst: per week, lowest-revenue day and highest-items-sold day
WITH daily AS (
  SELECT
    date_trunc('week', t.transactiontime)::date AS week_start,
    t.transactiontime::date AS day,
    SUM(t.totalamount) AS day_revenue,
    COALESCE(SUM(ti.quantity), 0) AS items_sold
  FROM transactions t
  LEFT JOIN transactionitem ti ON ti.transactionid = t.transactionid
  WHERE t.status = 'completed'
  GROUP BY 1, 2
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY day_revenue ASC)  AS rn_low_rev,
    ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY items_sold DESC)  AS rn_high_items
  FROM daily
)
SELECT
  week_start,
  MAX(CASE WHEN rn_low_rev = 1 THEN day END) AS worst_revenue_day,
  MAX(CASE WHEN rn_low_rev = 1 THEN day_revenue END) AS worst_day_revenue,
  MAX(CASE WHEN rn_high_items = 1 THEN day END) AS best_items_day,
  MAX(CASE WHEN rn_high_items = 1 THEN items_sold END) AS best_day_items_sold
FROM ranked
GROUP BY week_start
ORDER BY week_start;

-- 6) X-Report
WITH hours AS ( +
                  SELECT generate_series(0,23) AS hour_of_day +
                ), day_tx AS ( +
                  SELECT EXTRACT(HOUR FROM t.transactiontime)::int AS hour_of_day, +
                         t.totalamount, +
                         t.paymentmethod +
                  FROM transactions t +
                  WHERE t.status = 'completed' +
                    AND DATE(t.transactiontime) = CURRENT_DATE +
                ) +
                SELECT h.hour_of_day, +
                       COALESCE(COUNT(d.totalamount), 0) AS orders, +
                       COALESCE(SUM(d.totalamount), 0) AS revenue, +
                       COALESCE(SUM(CASE WHEN d.paymentmethod='cash' THEN d.totalamount ELSE 0 END), 0) AS cash_total, +
                       COALESCE(SUM(CASE WHEN d.paymentmethod='card' THEN d.totalamount ELSE 0 END), 0) AS card_total, +
                       COALESCE(SUM(CASE WHEN d.paymentmethod='applepay' THEN d.totalamount ELSE 0 END), 0) AS applepay_total  +
                FROM hours h  +
                LEFT JOIN day_tx d ON d.hour_of_day = h.hour_of_day  +
                GROUP BY h.hour_of_day  +
                ORDER BY h.hour_of_day;
