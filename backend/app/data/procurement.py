
"""
GridStock AI - Supplier and Procurement Data Generator

Generates supplier-material relationships and supplier-specific
purchase order delivery information.

All records are synthetic prototype data.
"""

from __future__ import annotations

import random
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from app.data.master_data import generate_master_data
from app.data.inventory import generate_inventory


RANDOM_SEED = 42


def generate_procurement(
    seed: int = RANDOM_SEED,
) -> dict[str, list[dict[str, Any]]]:

    rng = random.Random(seed)

    master = generate_master_data(seed=seed)
    inventory = generate_inventory(seed=seed)

    materials = master["materials"]
    suppliers = master["suppliers"]

    # Define supplier specializations.
    category_mapping = {
        "SUP-001": ["Transformer", "Switchgear"],
        "SUP-002": ["Cable", "Conductor"],
        "SUP-003": ["Transformer"],
        "SUP-004": ["Cable", "Conductor"],
        "SUP-005": ["Meter", "Protection"],
        "SUP-006": ["Switchgear", "Protection"],
        "SUP-007": ["Pole", "Insulator"],
        "SUP-008": ["Consumables", "Insulator", "Meter"],
    }

    supplier_materials = []

    for supplier in suppliers:
        supplier_code = supplier["supplier_code"]
        supported_categories = category_mapping[supplier_code]

        for material in materials:
            if material["category"] in supported_categories:

                supplier_materials.append({
                    "supplier_code": supplier_code,
                    "item_code": material["item_code"],
                    "unit_cost": material["unit_cost"],
                    "supplier_lead_time_days": (
                        supplier["average_lead_time_days"]
                    ),
                    "lead_time_std_days": (
                        supplier["lead_time_std_days"]
                    ),
                    "reliability_score": (
                        supplier["reliability_score"]
                    ),
                    "source": "SYNTHETIC",
                })

    supplier_lookup = defaultdict(list)

    for relationship in supplier_materials:
        supplier_lookup[relationship["item_code"]].append(
            relationship
        )

    purchase_orders = []

    for order in inventory["purchase_orders"]:

        compatible_suppliers = supplier_lookup.get(
            order["item_code"],
            [],
        )

        if not compatible_suppliers:
            continue

        # Prefer suppliers with better reliability.
        supplier = max(
            compatible_suppliers,
            key=lambda s: (
                s["reliability_score"] + rng.uniform(-0.08, 0.08)
            ),
        )

        order_date = date.fromisoformat(order["order_week"])

        expected_days = supplier["supplier_lead_time_days"]
        variation = round(
            rng.gauss(0, supplier["lead_time_std_days"])
        )

        actual_lead_time = max(
            3,
            expected_days + variation,
        )

        expected_arrival = order_date + timedelta(
            days=expected_days
        )

        actual_arrival = order_date + timedelta(
            days=actual_lead_time
        )

        today = date.today()

        if actual_arrival <= today:
            status = "RECEIVED"
        else:
            status = "IN_TRANSIT"

        is_delayed = actual_lead_time > expected_days

        purchase_orders.append({
            "po_id": order["po_id"],
            "supplier_code": supplier["supplier_code"],
            "item_code": order["item_code"],
            "location_code": order["location_code"],
            "order_date": order_date.isoformat(),
            "ordered_quantity": order["ordered_quantity"],
            "unit_cost": supplier["unit_cost"],
            "total_cost": round(
                order["ordered_quantity"] * supplier["unit_cost"],
                2,
            ),
            "expected_lead_time_days": expected_days,
            "actual_lead_time_days": actual_lead_time,
            "expected_arrival_date": expected_arrival.isoformat(),
            "actual_arrival_date": actual_arrival.isoformat(),
            "is_delayed": is_delayed,
            "status": status,
            "source": "SYNTHETIC",
        })

    supplier_performance = []

    for supplier in suppliers:

        supplier_orders = [
            order
            for order in purchase_orders
            if order["supplier_code"] == supplier["supplier_code"]
        ]

        received_orders = [
            order
            for order in supplier_orders
            if order["status"] == "RECEIVED"
        ]

        delayed_orders = [
            order
            for order in received_orders
            if order["is_delayed"]
        ]

        total_orders = len(received_orders)

        on_time_rate = (
            (total_orders - len(delayed_orders)) / total_orders
            if total_orders else 0
        )

        average_lead_time = (
            sum(
                order["actual_lead_time_days"]
                for order in received_orders
            ) / total_orders
            if total_orders else 0
        )

        supplier_performance.append({
            "supplier_code": supplier["supplier_code"],
            "supplier_name": supplier["supplier_name"],
            "total_orders": len(supplier_orders),
            "received_orders": total_orders,
            "delayed_orders": len(delayed_orders),
            "on_time_delivery_rate": round(on_time_rate, 3),
            "average_actual_lead_time_days": round(
                average_lead_time,
                2,
            ),
            "source": "SYNTHETIC",
        })

    return {
        "supplier_materials": supplier_materials,
        "purchase_orders": purchase_orders,
        "supplier_performance": supplier_performance,
    }


if __name__ == "__main__":

    data = generate_procurement()

    print("GRIDSTOCK AI - PROCUREMENT GENERATOR")
    print("-" * 48)

    print(
        "Supplier-material relationships:",
        len(data["supplier_materials"]),
    )

    print(
        "Purchase orders:",
        len(data["purchase_orders"]),
    )

    print(
        "Supplier performance records:",
        len(data["supplier_performance"]),
    )

    print(
        "\nDelayed purchase orders:",
        sum(
            order["is_delayed"]
            for order in data["purchase_orders"]
        ),
    )

    print("\nSupplier performance:")

    for supplier in data["supplier_performance"]:
        print(supplier)
