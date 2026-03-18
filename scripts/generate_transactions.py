# generate_transactions_csv.py
# Exports DB-ready CSVs for:
#   public.transactions
#   public.transactionitem
#
# Matches schema exactly:
#   transactions(transactionid, cashierid, transactiontime, totalamount, paymentmethod, status)
#   transactionitem(transactionitemid, transactionid, productid, quantity, unitprice)

from __future__ import annotations

import csv
import os
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP


def money(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# -----------------------------
# CONFIG
# -----------------------------

END_DATE = date(2026, 2, 17)
WEEKS = 39
START_DATE = END_DATE - timedelta(weeks=WEEKS)
TARGET_TOTAL = Decimal("750000.00")

OPEN_HOUR = 11
CLOSE_HOUR = 22

PEAK_DAYS = [
    date(2025, 8, 25),
    date(2026, 1, 13),
]

VOID_RATE = 0.02

# Use lowercase to match your DB defaults/style
PAYMENT_METHODS = [("card", 0.70), ("applepay", 0.20), ("cash", 0.10)]

# cashierid FK: must exist in cashier table
CASHIER_IDS = [1, 2, 3, 4]


@dataclass(frozen=True)
class Product:
    productid: int
    name: str
    baseprice: Decimal
    weight: float


# productid FK: must exist in product table
PRODUCTS = [
    Product(1,  "Classic Milk Tea",       Decimal("5.49"), 1.30),
    Product(2,  "Brown Sugar Milk Tea",   Decimal("5.99"), 1.25),
    Product(3,  "Taro Milk Tea",          Decimal("5.99"), 1.10),
    Product(4,  "Matcha Milk Tea",        Decimal("6.49"), 0.95),
    Product(5,  "Thai Tea",               Decimal("5.99"), 1.10),
    Product(6,  "Honey Green Tea",        Decimal("5.29"), 0.75),
    Product(7,  "Jasmine Green Tea",      Decimal("4.99"), 0.55),
    Product(8,  "Black Tea Lemonade",     Decimal("5.29"), 0.60),
    Product(9,  "Strawberry Green Tea",   Decimal("5.79"), 0.85),
    Product(10, "Mango Green Tea",        Decimal("5.79"), 0.90),
    Product(11, "Peach Green Tea",        Decimal("5.79"), 0.80),
    Product(12, "Lychee Green Tea",       Decimal("5.79"), 0.75),
    Product(13, "Coffee Milk Tea",        Decimal("6.49"), 0.55),
    Product(14, "Wintermelon Milk Tea",   Decimal("5.99"), 0.70),
    Product(15, "Oolong Milk Tea",        Decimal("5.79"), 0.65),
    Product(16, "Extra Boba Add-on",      Decimal("0.75"), 0.40),
]


def weighted_choice(items):
    total = sum(w for _, w in items)
    r = random.random() * total
    upto = 0.0
    for item, w in items:
        upto += w
        if upto >= r:
            return item
    return items[-1][0]


def pick_paymentmethod() -> str:
    return weighted_choice(PAYMENT_METHODS)


def pick_time_for_day(d: date) -> datetime:
    buckets = [
        (11, 0.05), (12, 0.10), (13, 0.12), (14, 0.08),
        (15, 0.10), (16, 0.12), (17, 0.12), (18, 0.10),
        (19, 0.10), (20, 0.10), (21, 0.06), (22, 0.05),
    ]
    hour = max(OPEN_HOUR, min(CLOSE_HOUR, weighted_choice(buckets)))
    return datetime(d.year, d.month, d.day, hour, random.randint(0, 59), random.randint(0, 59))


def baseline_orders_for_day(d: date) -> int:
    wd = d.weekday()  # Mon=0..Sun=6
    if wd <= 3:
        base = random.randint(230, 280)
    elif wd == 4:
        base = random.randint(260, 320)
    else:
        base = random.randint(280, 360)

    if d.month in (8, 9, 10, 11, 2, 3, 4):
        base = int(base * random.uniform(1.00, 1.08))
    if d.month in (6, 7):
        base = int(base * random.uniform(0.85, 0.95))

    if d in PEAK_DAYS:
        base = int(base * random.uniform(2.2, 2.8))

    return max(50, base)


def pick_line_items():
    num_lines = random.choices([1, 2, 3, 4], weights=[0.55, 0.27, 0.13, 0.05])[0]
    chosen = random.choices(PRODUCTS, weights=[p.weight for p in PRODUCTS], k=num_lines)

    out = []
    for p in chosen:
        qty = random.choices([1, 2], weights=[0.86, 0.14])[0]
        out.append((p, qty))

    if random.random() < 0.22:
        out.append((PRODUCTS[-1], 1))

    return out


def generate():
    random.seed(25)

    tx_rows = []
    item_rows = []

    transactionid = 1
    transactionitemid = 5

    d = START_DATE
    gross = Decimal("0.00")

    while d <= END_DATE:
        n = baseline_orders_for_day(d)

        for _ in range(n):
            tid = transactionid
            transactionid += 1

            cashierid = random.choice(CASHIER_IDS)
            tstamp = pick_time_for_day(d)

            voided = (random.random() < VOID_RATE)
            status = "voided" if voided else "completed"
            paymentmethod = pick_paymentmethod()

            if voided:
                tx_rows.append((tid, cashierid, tstamp, Decimal("0.00"), paymentmethod, status))
                continue

            total = Decimal("0.00")
            for p, qty in pick_line_items():
                unit = money(p.baseprice * Decimal(str(random.uniform(0.97, 1.03))))
                total += unit * qty

                iid = transactionitemid
                transactionitemid += 1
                item_rows.append((iid, tid, p.productid, qty, unit))

            total = money(total)
            gross += total
            tx_rows.append((tid, cashierid, tstamp, total, paymentmethod, status))

        d += timedelta(days=1)

    if gross == 0:
        raise RuntimeError("Generated zero sales; check config.")

    scale = TARGET_TOTAL / gross
    scale = max(Decimal("0.85"), min(Decimal("1.15"), scale))

    scaled_tx = []
    for tid, cashierid, tstamp, total, paymentmethod, status in tx_rows:
        if status == "completed":
            total = money(total * scale)
        scaled_tx.append((tid, cashierid, tstamp, total, paymentmethod, status))

    scaled_items = []
    for iid, tid, pid, qty, unit in item_rows:
        unit = money(unit * scale)
        scaled_items.append((iid, tid, pid, qty, unit))

    final_total = sum((t[3] for t in scaled_tx), Decimal("0.00"))
    return scaled_tx, scaled_items, final_total


def write_csvs(tx_rows, item_rows, final_total: Decimal):
    os.makedirs("../data", exist_ok=True)

    tx_path = "../data/transactions.csv"
    items_path = "../data/transactionitem.csv"

    # transactions.csv
    with open(tx_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["transactionid", "cashierid", "transactiontime", "totalamount", "paymentmethod", "status"])
        for tid, cashierid, tstamp, total, paymentmethod, status in tx_rows:
            w.writerow([
                tid,
                cashierid,
                tstamp.strftime("%Y-%m-%d %H:%M:%S"),
                f"{money(total)}",
                paymentmethod,
                status,
            ])

    # transactionitem.csv
    with open(items_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["transactionitemid", "transactionid", "productid", "quantity", "unitprice"])
        for iid, tid, pid, qty, unit in item_rows:
            w.writerow([
                iid,
                tid,
                pid,
                qty,
                f"{money(unit)}",
            ])

    print(f"Written to {tx_path}")
    print(f"Written to {items_path}")
    print(f"  Transactions: {len(tx_rows):,}")
    print(f"  Items:        {len(item_rows):,}")
    print(f"  Total sales:  {final_total}")
    print(f"  Peak day 1:   {PEAK_DAYS[0]}")
    print(f"  Peak day 2:   {PEAK_DAYS[1]}")


def main():
    tx_rows, item_rows, final_total = generate()
    write_csvs(tx_rows, item_rows, final_total)


if __name__ == "__main__":
    main()
