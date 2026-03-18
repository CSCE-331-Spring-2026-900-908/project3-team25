--schema_ty.sql

-- Reset tables. drop tables that depend on it as well
DROP TABLE IF EXISTS RestockOrderItem CASCADE;
DROP TABLE IF EXISTS RestockOrder CASCADE;
DROP TABLE IF EXISTS ProductIngredient CASCADE;
DROP TABLE IF EXISTS TransactionItem CASCADE;
DROP TABLE IF EXISTS Transactions CASCADE;
DROP TABLE IF EXISTS Product CASCADE;
DROP TABLE IF EXISTS Inventory CASCADE;
DROP TABLE IF EXISTS Cashier CASCADE;
DROP TABLE IF EXISTS Manager CASCADE;

-- Cashier
CREATE TABLE Cashier (
    cashierID     SERIAL PRIMARY KEY,
    firstName     VARCHAR(50)  NOT NULL,
    lastName      VARCHAR(50)  NOT NULL,
    hireDate      DATE         NOT NULL,
    hoursWorked   NUMERIC(8,2) NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    pin           VARCHAR(16)  NOT NULL DEFAULT '1234'
);

-- Manager
CREATE TABLE Manager (
    managerID   SERIAL PRIMARY KEY,
    firstName   VARCHAR(50) NOT NULL,
    lastName    VARCHAR(50) NOT NULL,
    hireDate    DATE        NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    pin         VARCHAR(16) NOT NULL DEFAULT '1234'
);

-- Inventory 
CREATE TABLE Inventory (
    inventoryID       SERIAL PRIMARY KEY,
    itemName          VARCHAR(100)   NOT NULL UNIQUE,
    unit              VARCHAR(20)    NOT NULL,  -- 'ml', 'g', 'quantity'
    quantityOnHand    NUMERIC(10,2)  NOT NULL DEFAULT 0,
    reorderThreshold  NUMERIC(10,2)  NOT NULL DEFAULT 0,
    unitCost          NUMERIC(8,4)   NOT NULL DEFAULT 0,
    vendor            VARCHAR(100)
);

-- Product
-- We ned to add a SEASONAL DRINK!!!!!!!
CREATE TABLE Product (
    productID    SERIAL PRIMARY KEY,
    name         VARCHAR(100)   NOT NULL UNIQUE,
    category     VARCHAR(50)    NOT NULL,  -- e.g. 'Milk Tea', 'Fruit Tea', 'Slush'
    basePrice    NUMERIC(6,2)   NOT NULL,
    is_active    BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ProductIngredient  (recipe: how much of each inventory item a single serving of a product uses) update when adding new products
CREATE TABLE ProductIngredient (
    productID    INT            NOT NULL REFERENCES Product(productID),
    inventoryID  INT            NOT NULL REFERENCES Inventory(inventoryID),
    amountUsed   NUMERIC(10,4)  NOT NULL,  -- in the same unit as Inventory.unit
    PRIMARY KEY (productID, inventoryID)
);

-- Transactions  (one row per customer order)
CREATE TABLE Transactions (
    transactionID    SERIAL PRIMARY KEY,
    cashierID        INT            NOT NULL REFERENCES Cashier(cashierID),
    transactionTime  TIMESTAMP      NOT NULL,
    totalAmount      NUMERIC(8,2)   NOT NULL,
    paymentMethod    VARCHAR(20)    NOT NULL DEFAULT 'card',
    status           VARCHAR(20)    NOT NULL DEFAULT 'completed'
);

-- Index for time-based queries. Speeds up search on transactionTime for the special queries
CREATE INDEX idx_transactions_time ON Transactions(transactionTime);

-- TransactionItem  (line items within an order)
CREATE TABLE TransactionItem (
    transactionItemID  SERIAL PRIMARY KEY,
    transactionID      INT           NOT NULL REFERENCES Transactions(transactionID),
    productID          INT           NOT NULL REFERENCES Product(productID),
    quantity           INT           NOT NULL DEFAULT 1,
    unitPrice          NUMERIC(6,2)  NOT NULL
);

-- Index for product-level sales queries
CREATE INDEX idx_transactionitem_product ON TransactionItem(productID);
CREATE INDEX idx_transactionitem_transaction ON TransactionItem(transactionID);

-- RestockOrder  (a manager-created restocking event)
CREATE TABLE RestockOrder (
    restockOrderID  SERIAL PRIMARY KEY,
    managerID       INT         NOT NULL REFERENCES Manager(managerID),
    orderDate       DATE        NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'  -- 'pending', 'received', 'cancelled'
);

-- RestockOrderItem  (line items within a restock order)
CREATE TABLE RestockOrderItem (
    restockOrderItemID  SERIAL PRIMARY KEY,
    restockOrderID      INT           NOT NULL REFERENCES RestockOrder(restockOrderID),
    inventoryID         INT           NOT NULL REFERENCES Inventory(inventoryID),
    quantityOrdered     NUMERIC(10,2) NOT NULL
);