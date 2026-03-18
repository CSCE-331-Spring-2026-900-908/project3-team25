\set ON_ERROR_STOP on
\copy cashier(cashierid, firstname, lastname, hiredate, hoursworked, is_active, pin) FROM 'data/cashier.csv' WITH (FORMAT csv, HEADER true);
\copy manager(managerid, firstname, lastname, hiredate, is_active, pin) FROM 'data/manager.csv' WITH (FORMAT csv, HEADER true);
\copy inventory(inventoryid, itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor) FROM 'data/inventory.csv' WITH (FORMAT csv, HEADER true);
\copy product(productid, name, category, baseprice, is_active) FROM 'data/product.csv' WITH (FORMAT csv, HEADER true);
\copy productingredient(productid, inventoryid, amountused) FROM 'data/productingredient.csv' WITH (FORMAT csv, HEADER true);
\copy transactions(transactionid, cashierid, transactiontime, totalamount, paymentmethod, status) FROM 'data/transactions.csv' WITH (FORMAT csv, HEADER true);
\copy transactionitem(transactionitemid, transactionid, productid, quantity, unitprice) FROM 'data/transactionitem.csv' WITH (FORMAT csv, HEADER true);

-- transactions
SELECT setval(pg_get_serial_sequence('transactions','transactionid'),
              (SELECT COALESCE(MAX(transactionid),0) FROM transactions));

-- transactionitem
SELECT setval(pg_get_serial_sequence('transactionitem','transactionitemid'),
              (SELECT COALESCE(MAX(transactionitemid),0) FROM transactionitem));

-- cashier
SELECT setval(pg_get_serial_sequence('cashier','cashierid'),
              (SELECT COALESCE(MAX(cashierid),0) FROM cashier));

-- manager
SELECT setval(pg_get_serial_sequence('manager','managerid'),
              (SELECT COALESCE(MAX(managerid),0) FROM manager));

-- inventory
SELECT setval(pg_get_serial_sequence('inventory','inventoryid'),
              (SELECT COALESCE(MAX(inventoryid),0) FROM inventory));

-- product
SELECT setval(pg_get_serial_sequence('product','productid'),
              (SELECT COALESCE(MAX(productid),0) FROM product));

SELECT setval(
  pg_get_serial_sequence('restockorder','restockorderid'),
  COALESCE((SELECT MAX(restockorderid) FROM restockorder), 1),
  (SELECT COUNT(*) > 0 FROM restockorder)
);

SELECT setval(
  pg_get_serial_sequence('restockorderitem','restockorderitemid'),
  COALESCE((SELECT MAX(restockorderitemid) FROM restockorderitem), 1),
  (SELECT COUNT(*) > 0 FROM restockorderitem)
);