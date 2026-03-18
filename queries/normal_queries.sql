-- the rest oft eh normal queries to get to 12 total
-- =====================
-- NORMAL QUERIES
-- =====================

-- A) Low stock inventory (needs reorder)
SELECT
  inventoryid,
  itemname,
  unit,
  quantityonhand,
  reorderthreshold,
  unitcost,
  vendor
FROM inventory
WHERE quantityonhand <= reorderthreshold
ORDER BY (reorderthreshold - quantityonhand) DESC;

-- B) Top 10 products by revenue
SELECT
  p.productid,
  p.name,
  SUM(ti.quantity) AS units_sold,
  SUM(ti.quantity * ti.unitprice) AS revenue
FROM transactionitem ti
JOIN product p ON p.productid = ti.productid
JOIN transactions t ON t.transactionid = ti.transactionid
WHERE t.status = 'completed'
GROUP BY p.productid, p.name
ORDER BY revenue DESC
LIMIT 10;

-- C) Top 10 products by units sold
SELECT
  p.productid,
  p.name,
  SUM(ti.quantity) AS units_sold
FROM transactionitem ti
JOIN product p ON p.productid = ti.productid
JOIN transactions t ON t.transactionid = ti.transactionid
WHERE t.status = 'completed'
GROUP BY p.productid, p.name
ORDER BY units_sold DESC
LIMIT 10;

-- D) Payment method distribution
SELECT
  paymentmethod,
  COUNT(*) AS orders,
  SUM(totalamount) AS revenue
FROM transactions
WHERE status = 'completed'
GROUP BY paymentmethod
ORDER BY orders DESC;

-- E) Monthly revenue trend
SELECT
  date_trunc('month', transactiontime)::date AS month_start,
  COUNT(*) AS orders,
  SUM(totalamount) AS revenue
FROM transactions
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1;

-- F) Average order value
SELECT
  AVG(totalamount)::numeric(10,2) AS avg_order_value
FROM transactions
WHERE status='completed';

-- G) Cashier performance (orders + revenue)
SELECT
  c.cashierid,
  c.firstname,
  c.lastname,
  COUNT(*) AS completed_orders,
  SUM(t.totalamount) AS revenue
FROM transactions t
JOIN cashier c ON c.cashierid = t.cashierid
WHERE t.status='completed'
GROUP BY c.cashierid, c.firstname, c.lastname
ORDER BY revenue DESC;
