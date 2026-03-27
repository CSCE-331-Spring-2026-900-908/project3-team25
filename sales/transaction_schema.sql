--transaction_schema.sql

CREATE TABLE IF NOT EXISTS Transaction (
  transaction_id   BIGINT PRIMARY KEY,
  cashier_id       INT NOT NULL REFERENCES cashier(cashier_id),
  transaction_time TIMESTAMP NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  payment_method   VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','CARD','APPLEPAY')),
  status           VARCHAR(12) NOT NULL CHECK (status IN ('COMPLETED','VOIDED'))
);