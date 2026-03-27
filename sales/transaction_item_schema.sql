-- sales/transaction_item_schema.sql
CREATE TABLE IF NOT EXISTS TransactionItem (
  transaction_item_id BIGINT PRIMARY KEY,
  transaction_id      BIGINT NOT NULL REFERENCES transaction(transaction_id) ON DELETE CASCADE,
  product_id          INT NOT NULL REFERENCES product(product_id),
  quantity            INT NOT NULL CHECK (quantity > 0),
  unit_price          DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0)
);