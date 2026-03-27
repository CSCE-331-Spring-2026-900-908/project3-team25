# general_seed.py
# Exports DB-ready CSVs matching your schemas exactly:
#   cashier(cashierid, firstname, lastname, hiredate, hoursworked, is_active, pin)
#   manager(managerid, firstname, lastname, hiredate, is_active, pin)
#   inventory(inventoryid, itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor)
#   product(productid, name, category, baseprice, is_active)
#   productingredient(productid, inventoryid, amountused)

from __future__ import annotations

import csv
import os
from decimal import Decimal


# -----------------------------
# DATA (same as your seed)
# -----------------------------

DEFAULT_PIN = "1234"

# Explicit IDs so transactions.cashierid (1..4) will match
cashiers = [
    (1, "Ty",     "Macaulay",  "2022-08-15", Decimal("1840.50"), True, DEFAULT_PIN),
    (2, "Nick",   "Leon",      "2023-01-10", Decimal("1200.00"), True, DEFAULT_PIN),
    (3, "Ali",    "Hussein",   "2023-05-22", Decimal("980.75"),  True, DEFAULT_PIN),
    (4, "Sonny",  "Hernandez", "2024-02-01", Decimal("540.00"),  True, DEFAULT_PIN),
]

# Explicit IDs (safe, and avoids sequence mismatch later)
managers = [
    (1, "Joe",     "Joe",   "2020-03-01", True, DEFAULT_PIN),
    (2, "Daniel",  "Smith", "2021-07-15", True, DEFAULT_PIN),
]

# Explicit IDs + itemname UNIQUE, so keep stable IDs
inventory = [
    # inventoryid, itemname, unit, quantityonhand, reorderthreshold, unitcost, vendor
    (1,  "Black Tea Base",        "ml",       Decimal("50000"),  Decimal("10000"), Decimal("0.0030"), "Sharetea Supplier Co."),
    (2,  "Green Tea Base",        "ml",       Decimal("50000"),  Decimal("10000"), Decimal("0.0028"), "Sharetea Supplier Co."),
    (3,  "Oolong Tea Base",       "ml",       Decimal("30000"),  Decimal("8000"),  Decimal("0.0035"), "Sharetea Supplier Co."),
    (4,  "Jasmine Tea Base",      "ml",       Decimal("30000"),  Decimal("8000"),  Decimal("0.0032"), "Sharetea Supplier Co."),
    (5,  "Thai Tea Base",         "ml",       Decimal("20000"),  Decimal("5000"),  Decimal("0.0040"), "Sharetea Supplier Co."),
    (6,  "Matcha Powder",         "g",        Decimal("10000"),  Decimal("2000"),  Decimal("0.0500"), "Matcha Masters LLC"),
    (7,  "Taro Powder",           "g",        Decimal("10000"),  Decimal("2000"),  Decimal("0.0350"), "Sharetea Supplier Co."),
    (8,  "Brown Sugar Syrup",     "ml",       Decimal("20000"),  Decimal("4000"),  Decimal("0.0060"), "Sharetea Supplier Co."),
    (9,  "Wintermelon Syrup",     "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0055"), "Sharetea Supplier Co."),
    (10, "Honey",                 "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0080"), "Local Honey Farm"),
    (11, "Strawberry Syrup",      "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0065"), "FreshFlavor Inc."),
    (12, "Mango Syrup",           "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0065"), "FreshFlavor Inc."),
    (13, "Peach Syrup",           "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0065"), "FreshFlavor Inc."),
    (14, "Lychee Syrup",          "ml",       Decimal("15000"),  Decimal("3000"),  Decimal("0.0065"), "FreshFlavor Inc."),
    (15, "Lemon Juice",           "ml",       Decimal("10000"),  Decimal("2000"),  Decimal("0.0045"), "FreshFlavor Inc."),
    (16, "Whole Milk",            "ml",       Decimal("40000"),  Decimal("8000"),  Decimal("0.0015"), "Dairy Direct"),
    (17, "Coffee Concentrate",    "ml",       Decimal("10000"),  Decimal("2000"),  Decimal("0.0100"), "Brew Supply Co."),
    (18, "Tapioca Pearls (dry)",  "g",        Decimal("20000"),  Decimal("5000"),  Decimal("0.0120"), "Sharetea Supplier Co."),
    (19, "Large Cup (700ml)",     "quantity", Decimal("5000"),   Decimal("1000"),  Decimal("0.0800"), "PackagingPro"),
    (20, "Medium Cup (500ml)",    "quantity", Decimal("5000"),   Decimal("1000"),  Decimal("0.0700"), "PackagingPro"),
    (21, "Dome Lid",              "quantity", Decimal("10000"),  Decimal("2000"),  Decimal("0.0300"), "PackagingPro"),
    (22, "Flat Lid",              "quantity", Decimal("5000"),   Decimal("1000"),  Decimal("0.0250"), "PackagingPro"),
    (23, "Boba Straw",            "quantity", Decimal("10000"),  Decimal("2000"),  Decimal("0.0200"), "PackagingPro"),
    (24, "Regular Straw",         "quantity", Decimal("5000"),   Decimal("1000"),  Decimal("0.0150"), "PackagingPro"),
    (25, "Napkin",                "quantity", Decimal("20000"),  Decimal("5000"),  Decimal("0.0050"), "PackagingPro"),
    (26, "Carry Bag",             "quantity", Decimal("5000"),   Decimal("1000"),  Decimal("0.1200"), "PackagingPro"),
    (27, "Sugar (white)",         "g",        Decimal("10000"),  Decimal("2000"),  Decimal("0.0010"), "Grocery Wholesale"),
    (28, "Ice",                   "g",        Decimal("100000"), Decimal("20000"), Decimal("0.0002"), "Ice Supply Co."),
]

# Explicit product IDs so transactionitem.productid (1..16) matches
products = [
    # productid, name, category, baseprice, is_active
    (1,  "Classic Milk Tea",        "milk_tea",  Decimal("5.49"), True),
    (2,  "Brown Sugar Milk Tea",    "milk_tea",  Decimal("5.99"), True),
    (3,  "Taro Milk Tea",           "milk_tea",  Decimal("5.99"), True),
    (4,  "Matcha Milk Tea",         "milk_tea",  Decimal("6.49"), True),
    (5,  "Thai Tea",                "milk_tea",  Decimal("5.99"), True),
    (6,  "Honey Green Tea",         "tea",       Decimal("5.29"), True),
    (7,  "Jasmine Green Tea",       "tea",       Decimal("4.99"), True),
    (8,  "Black Tea Lemonade",      "tea",       Decimal("5.29"), True),
    (9,  "Strawberry Green Tea",    "fruit_tea", Decimal("5.79"), True),
    (10, "Mango Green Tea",         "fruit_tea", Decimal("5.79"), True),
    (11, "Peach Green Tea",         "fruit_tea", Decimal("5.79"), True),
    (12, "Lychee Green Tea",        "fruit_tea", Decimal("5.79"), True),
    (13, "Coffee Milk Tea",         "coffee",    Decimal("6.49"), True),
    (14, "Wintermelon Milk Tea",    "milk_tea",  Decimal("5.99"), True),
    (15, "Oolong Milk Tea",         "milk_tea",  Decimal("5.79"), True),
    (16, "Extra Boba Add-on",       "topping",   Decimal("0.75"), True),
]

# Helpful maps for productingredient (by name)
PRODUCT_ID_BY_NAME = {name: pid for (pid, name, _, _, _) in products}
INVENTORY_ID_BY_NAME = {itemname: iid for (iid, itemname, *_rest) in inventory}

productingredients: list[tuple[int, int, Decimal]] = []


def add_pi(product_name: str, inv_itemname: str, amount_used: Decimal) -> None:
    pid = PRODUCT_ID_BY_NAME[product_name]
    iid = INVENTORY_ID_BY_NAME[inv_itemname]
    productingredients.append((pid, iid, amount_used))


def supplies_boba(product_name: str) -> None:
    add_pi(product_name, "Large Cup (700ml)", Decimal("1"))
    add_pi(product_name, "Dome Lid",          Decimal("1"))
    add_pi(product_name, "Boba Straw",        Decimal("1"))
    add_pi(product_name, "Napkin",            Decimal("1"))
    add_pi(product_name, "Ice",               Decimal("150"))
    add_pi(product_name, "Sugar (white)",     Decimal("20"))


def supplies_tea(product_name: str) -> None:
    add_pi(product_name, "Large Cup (700ml)", Decimal("1"))
    add_pi(product_name, "Flat Lid",          Decimal("1"))
    add_pi(product_name, "Regular Straw",     Decimal("1"))
    add_pi(product_name, "Napkin",            Decimal("1"))
    add_pi(product_name, "Ice",               Decimal("150"))
    add_pi(product_name, "Sugar (white)",     Decimal("20"))


# ----- Recipes -----
p = "Classic Milk Tea"
add_pi(p, "Black Tea Base",       Decimal("300"))
add_pi(p, "Whole Milk",           Decimal("150"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Brown Sugar Milk Tea"
add_pi(p, "Black Tea Base",       Decimal("250"))
add_pi(p, "Whole Milk",           Decimal("150"))
add_pi(p, "Brown Sugar Syrup",    Decimal("60"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Taro Milk Tea"
add_pi(p, "Black Tea Base",       Decimal("200"))
add_pi(p, "Whole Milk",           Decimal("150"))
add_pi(p, "Taro Powder",          Decimal("40"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Matcha Milk Tea"
add_pi(p, "Green Tea Base",       Decimal("200"))
add_pi(p, "Whole Milk",           Decimal("150"))
add_pi(p, "Matcha Powder",        Decimal("35"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Thai Tea"
add_pi(p, "Thai Tea Base",        Decimal("300"))
add_pi(p, "Whole Milk",           Decimal("120"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Honey Green Tea"
add_pi(p, "Green Tea Base",       Decimal("350"))
add_pi(p, "Honey",                Decimal("40"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Jasmine Green Tea"
add_pi(p, "Jasmine Tea Base",     Decimal("400"))
supplies_tea(p)

p = "Black Tea Lemonade"
add_pi(p, "Black Tea Base",       Decimal("300"))
add_pi(p, "Lemon Juice",          Decimal("100"))
supplies_tea(p)

p = "Strawberry Green Tea"
add_pi(p, "Green Tea Base",       Decimal("300"))
add_pi(p, "Strawberry Syrup",     Decimal("60"))
supplies_tea(p)

p = "Mango Green Tea"
add_pi(p, "Green Tea Base",       Decimal("300"))
add_pi(p, "Mango Syrup",          Decimal("60"))
supplies_tea(p)

p = "Peach Green Tea"
add_pi(p, "Green Tea Base",       Decimal("300"))
add_pi(p, "Peach Syrup",          Decimal("60"))
supplies_tea(p)

p = "Lychee Green Tea"
add_pi(p, "Green Tea Base",       Decimal("300"))
add_pi(p, "Lychee Syrup",         Decimal("60"))
supplies_tea(p)

p = "Coffee Milk Tea"
add_pi(p, "Black Tea Base",       Decimal("200"))
add_pi(p, "Coffee Concentrate",   Decimal("100"))
add_pi(p, "Whole Milk",           Decimal("100"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Wintermelon Milk Tea"
add_pi(p, "Black Tea Base",       Decimal("300"))
add_pi(p, "Whole Milk",           Decimal("100"))
add_pi(p, "Wintermelon Syrup",    Decimal("60"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Oolong Milk Tea"
add_pi(p, "Oolong Tea Base",      Decimal("300"))
add_pi(p, "Whole Milk",           Decimal("150"))
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))
supplies_boba(p)

p = "Extra Boba Add-on"
add_pi(p, "Tapioca Pearls (dry)", Decimal("50"))


# -----------------------------
# CSV WRITERS
# -----------------------------

def write_csv(path: str, header: list[str], rows: list[list[str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main() -> None:
    os.makedirs("data", exist_ok=True)

    # cashier.csv
    cashier_rows: list[list[str]] = []
    for cashierid, firstname, lastname, hiredate, hoursworked, is_active, pin in cashiers:
        cashier_rows.append([
            str(cashierid),
            firstname,
            lastname,
            hiredate,
            f"{hoursworked:.2f}",
            "true" if is_active else "false",
            str(pin),
        ])
    write_csv(
        "data/cashier.csv",
        ["cashierid", "firstname", "lastname", "hiredate", "hoursworked", "is_active", "pin"],
        cashier_rows,
    )

    # manager.csv
    manager_rows: list[list[str]] = []
    for managerid, firstname, lastname, hiredate, is_active, pin in managers:
        manager_rows.append([
            str(managerid),
            firstname,
            lastname,
            hiredate,
            "true" if is_active else "false",
            str(pin),
        ])
    write_csv(
        "data/manager.csv",
        ["managerid", "firstname", "lastname", "hiredate", "is_active", "pin"],
        manager_rows,
    )

    # inventory.csv
    inventory_rows: list[list[str]] = []
    for inventoryid, itemname, unit, qoh, thresh, unitcost, vendor in inventory:
        inventory_rows.append([
            str(inventoryid),
            itemname,
            unit,
            f"{qoh:.2f}",
            f"{thresh:.2f}",
            f"{unitcost:.4f}",
            vendor if vendor is not None else "",
        ])
    write_csv(
        "data/inventory.csv",
        ["inventoryid", "itemname", "unit", "quantityonhand", "reorderthreshold", "unitcost", "vendor"],
        inventory_rows,
    )

    # product.csv
    product_rows: list[list[str]] = []
    for productid, name, category, baseprice, is_active in products:
        product_rows.append([
            str(productid),
            name,
            category,
            f"{baseprice:.2f}",
            "true" if is_active else "false",
        ])
    write_csv(
        "data/product.csv",
        ["productid", "name", "category", "baseprice", "is_active"],
        product_rows,
    )

    # productingredient.csv
    # IMPORTANT: (productid, inventoryid) must be unique per PK
    pi_rows: list[list[str]] = []
    seen: set[tuple[int, int]] = set()
    for pid, iid, amount in productingredients:
        key = (pid, iid)
        if key in seen:
            raise RuntimeError(f"Duplicate productingredient PK detected: productid={pid}, inventoryid={iid}")
        seen.add(key)
        pi_rows.append([
            str(pid),
            str(iid),
            f"{amount:.4f}",
        ])
    write_csv(
        "data/productingredient.csv",
        ["productid", "inventoryid", "amountused"],
        pi_rows,
    )

    print("Written to data/")
    print(f"  cashier.csv           ({len(cashiers)} rows)")
    print(f"  manager.csv           ({len(managers)} rows)")
    print(f"  inventory.csv         ({len(inventory)} rows)")
    print(f"  product.csv           ({len(products)} rows)")
    print(f"  productingredient.csv ({len(productingredients)} rows)")


if __name__ == "__main__":
    main()