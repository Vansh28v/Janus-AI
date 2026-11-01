"""
GRIDSTOCK AI
Integrated Inventory and Procurement Simulation

Synthetic prototype data only.

Simulation chronology:
1. Review stock and pipeline at the beginning of each week.
2. Place replenishment orders before weekly demand is consumed.
3. Process actual deliveries and demand chronologically.
4. Reconcile inventory and procurement records.
"""

from __future__ import annotations

import math
import random

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from app.data.master_data import generate_master_data
from app.data.consumption import generate_consumption

# ============================================================
# 1. CONFIGURATION
# ============================================================

RANDOM_SEED = 42

INITIAL_STOCK_COVER_WEEKS = 12
REORDER_BUFFER_WEEKS = 4
TARGET_BUFFER_WEEKS = 4
EMERGENCY_COVER_WEEKS = 2


SUPPLIER_CATEGORIES = {
    "SUP-001": ["Transformer", "Switchgear"],
    "SUP-002": ["Cable", "Conductor"],
    "SUP-003": ["Transformer"],
    "SUP-004": ["Cable", "Conductor"],
    "SUP-005": ["Meter", "Protection"],
    "SUP-006": ["Switchgear", "Protection"],
    "SUP-007": ["Pole", "Insulator"],
    "SUP-008": ["Consumables", "Insulator", "Meter"],
}


# ============================================================
# 2. HELPER FUNCTIONS
# ============================================================

def as_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def get_outstanding_quantity(
    outstanding_orders: list[dict[str, Any]],
) -> float:

    return sum(
        float(order["ordered_quantity"])
        for order in outstanding_orders
    )


def get_overdue_orders(
    outstanding_orders: list[dict[str, Any]],
    current_date: date,
) -> list[dict[str, Any]]:

    return [
        order
        for order in outstanding_orders
        if as_date(order["expected_arrival_date"]) < current_date
    ]


def get_dependable_pipeline(
    outstanding_orders: list[dict[str, Any]],
    current_date: date,
) -> float:

    return sum(
        float(order["ordered_quantity"])
        for order in outstanding_orders
        if as_date(order["expected_arrival_date"]) >= current_date
    )


def select_supplier(
    compatible_suppliers: list[dict[str, Any]],
    rng: random.Random,
    emergency: bool = False,
) -> dict[str, Any]:

    if not compatible_suppliers:
        raise ValueError("No compatible supplier found.")

    if emergency:
        # Prioritise the fastest compatible supplier.
        # This does not assume a special express delivery service.
        return min(
            compatible_suppliers,
            key=lambda supplier: (
                supplier["average_lead_time_days"],
                -supplier["reliability_score"],
            ),
        )

    return max(
        compatible_suppliers,
        key=lambda supplier: (
            supplier["reliability_score"]
            + rng.uniform(-0.08, 0.08)
        ),
    )


# ============================================================
# 3. INVENTORY AND PROCUREMENT GENERATION
# ============================================================

def generate_inventory(
    seed: int = RANDOM_SEED,
) -> dict[str, list[dict[str, Any]]]:

    rng = random.Random(seed)

    master = generate_master_data(seed=seed)
    consumption = generate_consumption(seed=seed)

    materials = {
        item["item_code"]: item
        for item in master["materials"]
    }

    suppliers = master["suppliers"]

    # --------------------------------------------------------
    # SUPPLIER-MATERIAL COMPATIBILITY
    # --------------------------------------------------------

    supplier_lookup = defaultdict(list)

    for supplier in suppliers:

        supported_categories = SUPPLIER_CATEGORIES.get(
            supplier["supplier_code"],
            [],
        )

        for material in master["materials"]:

            if material["category"] in supported_categories:

                supplier_lookup[
                    material["item_code"]
                ].append(supplier)

    # --------------------------------------------------------
    # AGGREGATE HISTORICAL DEMAND
    # --------------------------------------------------------

    demand_by_key = defaultdict(float)

    for record in consumption:

        key = (
            record["item_code"],
            record["location_code"],
            record["week_start"],
        )

        demand_by_key[key] += record["quantity_consumed"]

    series = defaultdict(list)

    for (item, location, week), quantity in demand_by_key.items():

        series[(item, location)].append(
            (week, quantity)
        )

    opening_balances = []
    movements = []
    weekly_inventory = []
    purchase_orders = []

    po_counter = 1

    # ========================================================
    # PROCESS EACH MATERIAL-LOCATION COMBINATION
    # ========================================================

    for (item_code, location_code), demand_series in series.items():

        demand_series.sort(key=lambda row: row[0])

        material = materials[item_code]

        compatible_suppliers = supplier_lookup[item_code]

        if not compatible_suppliers:
            raise ValueError(
                f"No compatible supplier for {item_code}"
            )

        quantities = [
            quantity
            for _, quantity in demand_series
        ]

        average_weekly_demand = (
            sum(quantities) / len(quantities)
            if quantities else 0.0
        )

        average_daily_demand = average_weekly_demand / 7.0

        lead_time_days = material["lead_time_days"]

        lead_time_weeks = max(
            1,
            math.ceil(lead_time_days / 7),
        )

        # ----------------------------------------------------
        # INITIAL STOCK
        # ----------------------------------------------------

        on_hand = max(
            1,
            math.ceil(
                average_weekly_demand
                * INITIAL_STOCK_COVER_WEEKS
            ),
        )

        opening_balances.append({
            "item_code": item_code,
            "location_code": location_code,
            "opening_quantity": on_hand,
            "source": "SYNTHETIC",
        })

        # ----------------------------------------------------
        # INVENTORY POLICY PARAMETERS
        # ----------------------------------------------------

        reorder_point = math.ceil(
            average_weekly_demand
            * (
                lead_time_weeks
                + REORDER_BUFFER_WEEKS
            )
        )

        target_stock = math.ceil(
            average_weekly_demand
            * (
                lead_time_weeks
                + REORDER_BUFFER_WEEKS
                + TARGET_BUFFER_WEEKS
            )
        )

        outstanding_orders = []

        # ====================================================
        # WEEKLY SIMULATION
        # ====================================================

        for week, requested_quantity in demand_series:

            week_start = as_date(week)
            week_end = week_start + timedelta(days=6)

            opening_stock = on_hand

            received_quantity = 0.0
            issued_quantity = 0.0
            unmet_quantity = 0.0

            ordered_quantity = 0.0
            emergency_replenishment = False

            # =================================================
            # A. REPLENISHMENT DECISION AT WEEK START
            # =================================================
            # IMPORTANT:
            # No demand from the current week has been consumed.
            # This fixes the previous end-of-week ordering issue.

            overdue_orders = get_overdue_orders(
                outstanding_orders,
                week_start,
            )

            overdue_quantity = get_outstanding_quantity(
                overdue_orders
            )

            dependable_pipeline = get_dependable_pipeline(
                outstanding_orders,
                week_start,
            )

            inventory_position = (
                on_hand + dependable_pipeline
            )

            # ------------------------------------------------
            # NEXT EXPECTED DELIVERY
            # ------------------------------------------------

            future_expected_dates = []

            for order in outstanding_orders:

                expected_date = as_date(
                    order["expected_arrival_date"]
                )

                if expected_date >= week_start:
                    future_expected_dates.append(expected_date)

            next_expected_delivery = (
                min(future_expected_dates)
                if future_expected_dates
                else None
            )

            if next_expected_delivery is not None:

                days_until_next_delivery = max(
                    0,
                    (
                        next_expected_delivery - week_start
                    ).days,
                )

                demand_until_next_delivery = (
                    average_daily_demand
                    * days_until_next_delivery
                )

                delivery_gap_risk = (
                    on_hand < demand_until_next_delivery
                )

            else:

                days_until_next_delivery = None
                demand_until_next_delivery = 0.0
                delivery_gap_risk = False

            # ------------------------------------------------
            # STOCK COVERAGE AT WEEK START
            # ------------------------------------------------

            if average_daily_demand > 0:

                stock_cover_days = (
                    on_hand / average_daily_demand
                )

            else:

                stock_cover_days = float("inf")

            stock_cover_weeks = stock_cover_days / 7.0

            critical_stock = (
                stock_cover_weeks <= EMERGENCY_COVER_WEEKS
            )

            overdue_delivery_risk = (
                overdue_quantity > 0
            )

            no_pipeline_low_stock = (
                len(outstanding_orders) == 0
                and on_hand
                < average_weekly_demand * EMERGENCY_COVER_WEEKS
            )

            emergency_replenishment = (
                critical_stock
                and (
                    overdue_delivery_risk
                    or delivery_gap_risk
                    or no_pipeline_low_stock
                )
            )

            normal_replenishment = (
                inventory_position <= reorder_point
            )

            # =================================================
            # B. PLACE PURCHASE ORDER BEFORE DEMAND
            # =================================================

            if (
                normal_replenishment
                or emergency_replenishment
            ):

                shortage_to_target = max(
                    0.0,
                    target_stock - inventory_position,
                )

                projected_shortage = max(
                    0.0,
                    demand_until_next_delivery - on_hand,
                )

                if emergency_replenishment:

                    ordered_quantity = max(
                        shortage_to_target,
                        projected_shortage,
                    )

                else:

                    ordered_quantity = shortage_to_target

                if ordered_quantity > 0:

                    supplier = select_supplier(
                        compatible_suppliers,
                        rng,
                        emergency=emergency_replenishment,
                    )

                    expected_lead_time = int(
                        supplier["average_lead_time_days"]
                    )

                    actual_lead_time = max(
                        3,
                        round(
                            rng.gauss(
                                expected_lead_time,
                                supplier["lead_time_std_days"],
                            )
                        ),
                    )

                    # Order is created at the beginning
                    # of the current week.

                    order_date = week_start

                    expected_arrival = (
                        order_date
                        + timedelta(days=expected_lead_time)
                    )

                    actual_arrival = (
                        order_date
                        + timedelta(days=actual_lead_time)
                    )

                    po_id = f"PO-{po_counter:06d}"

                    po_counter += 1

                    purchase_order = {

                        "po_id": po_id,

                        "order_week": week,

                        "order_date": order_date.isoformat(),

                        "expected_arrival_date": (
                            expected_arrival.isoformat()
                        ),

                        "actual_arrival_date": (
                            actual_arrival.isoformat()
                        ),

                        "item_code": item_code,

                        "location_code": location_code,

                        "supplier_code": supplier["supplier_code"],

                        "ordered_quantity": ordered_quantity,

                        "expected_lead_time_days": (
                            expected_lead_time
                        ),

                        "actual_lead_time_days": actual_lead_time,

                        "is_delayed": (
                            actual_lead_time > expected_lead_time
                        ),

                        "is_emergency": emergency_replenishment,

                        "status": "IN_TRANSIT",

                        "unit_cost": material["unit_cost"],

                        "total_cost": round(
                            ordered_quantity * material["unit_cost"],
                            2,
                        ),

                        "source": "SYNTHETIC",
                    }

                    purchase_orders.append(
                        purchase_order
                    )

                    # New PO enters the pipeline.
                    # It is NOT added to physical stock.

                    outstanding_orders.append(
                        purchase_order
                    )

            # =================================================
            # C. DAILY RECEIPT AND DEMAND PROCESSING
            # =================================================

            daily_demand = requested_quantity / 7.0

            for day_offset in range(7):

                current_date = (
                    week_start
                    + timedelta(days=day_offset)
                )

                remaining_orders = []

                # ---------------------------------------------
                # PROCESS ACTUAL ARRIVALS
                # ---------------------------------------------

                for order in outstanding_orders:

                    actual_arrival = as_date(
                        order["actual_arrival_date"]
                    )

                    if actual_arrival <= current_date:

                        quantity = order["ordered_quantity"]

                        on_hand += quantity

                        received_quantity += quantity

                        order["status"] = "RECEIVED"

                        order["receipt_date"] = (
                            current_date.isoformat()
                        )

                        movements.append({

                            "movement_date": current_date.isoformat(),

                            "week_start": week,

                            "item_code": item_code,

                            "location_code": location_code,

                            "movement_type": "RECEIPT",

                            "quantity": quantity,

                            "reference_id": order["po_id"],

                            "supplier_code": order["supplier_code"],

                            "source": "SYNTHETIC_SUPPLIER_RECEIPT",
                        })

                    else:

                        remaining_orders.append(order)

                outstanding_orders = remaining_orders

                # ---------------------------------------------
                # FULFIL DAILY DEMAND
                # ---------------------------------------------

                daily_issued = min(
                    on_hand,
                    daily_demand,
                )

                daily_unmet = max(
                    0.0,
                    daily_demand - daily_issued,
                )

                on_hand -= daily_issued

                issued_quantity += daily_issued

                unmet_quantity += daily_unmet

            # =================================================
            # D. RECORD ISSUE MOVEMENT
            # =================================================

            if issued_quantity > 0:

                movements.append({

                    "movement_date": week_end.isoformat(),

                    "week_start": week,

                    "item_code": item_code,

                    "location_code": location_code,

                    "movement_type": "ISSUE",

                    "quantity": issued_quantity,

                    "reference_id": (
                        f"ISS-{item_code}-{location_code}-{week}"
                    ),

                    "source": "HISTORICAL_CONSUMPTION",
                })

            # =================================================
            # E. END-OF-WEEK RECONCILIATION
            # =================================================

            outstanding_quantity = get_outstanding_quantity(
                outstanding_orders
            )

            overdue_orders_at_end = get_overdue_orders(
                outstanding_orders,
                week_end,
            )

            overdue_quantity_at_end = get_outstanding_quantity(
                overdue_orders_at_end
            )

            dependable_pipeline_at_end = get_dependable_pipeline(
                outstanding_orders,
                week_end,
            )

            closing_inventory_position = (
                on_hand + dependable_pipeline_at_end
            )

            if average_daily_demand > 0:

                closing_stock_cover_days = (
                    on_hand / average_daily_demand
                )

            else:

                closing_stock_cover_days = float("inf")

            weekly_inventory.append({

                "week_start": week,

                "item_code": item_code,

                "location_code": location_code,

                "opening_stock": opening_stock,

                "received_quantity": received_quantity,

                "requested_quantity": requested_quantity,

                "issued_quantity": issued_quantity,

                "unmet_quantity": unmet_quantity,

                "outstanding_quantity": outstanding_quantity,

                "overdue_quantity": overdue_quantity_at_end,

                "dependable_pipeline_quantity": (
                    dependable_pipeline_at_end
                ),

                "inventory_position": closing_inventory_position,

                "inventory_position_at_start": inventory_position,

                "closing_stock": on_hand,

                "reorder_point": reorder_point,

                "target_stock": target_stock,

                "stock_cover_days": (
                    closing_stock_cover_days
                    if math.isfinite(closing_stock_cover_days)
                    else None
                ),

                "stock_cover_days_at_start": (
                    stock_cover_days
                    if math.isfinite(stock_cover_days)
                    else None
                ),

                "days_until_next_delivery": (
                    days_until_next_delivery
                ),

                "projected_shortage_before_delivery": max(
                    0.0,
                    demand_until_next_delivery - opening_stock,
                ),

                "ordered_quantity": ordered_quantity,

                "emergency_replenishment": (
                    emergency_replenishment
                ),

                "unit": material["unit"],

                "source": "SYNTHETIC",
            })

    # ========================================================
    # FINALIZE PURCHASE ORDER STATUS
    # ========================================================

    for order in purchase_orders:

        if order["status"] != "RECEIVED":

            order["status"] = "OUTSTANDING"

    return {

        "opening_balances": opening_balances,

        "movements": movements,

        "weekly_inventory": weekly_inventory,

        "purchase_orders": purchase_orders,
    }


# ============================================================
# 4. INVENTORY VALIDATION
# ============================================================

def validate_inventory(
    inventory: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:

    records = inventory["weekly_inventory"]

    errors = []

    previous_closing = {}

    for index, record in enumerate(records):

        key = (
            record["item_code"],
            record["location_code"],
        )

        previous = previous_closing.get(key)

        if previous is not None:

            if not math.isclose(
                record["opening_stock"],
                previous,
                rel_tol=1e-9,
                abs_tol=1e-6,
            ):

                errors.append({

                    "row": index,

                    "issue": (
                        "Opening stock does not match "
                        "previous closing stock"
                    ),
                })

        expected_closing = (
            record["opening_stock"]
            + record["received_quantity"]
            - record["issued_quantity"]
        )

        if not math.isclose(
            record["closing_stock"],
            expected_closing,
            rel_tol=1e-9,
            abs_tol=1e-6,
        ):

            errors.append({

                "row": index,

                "issue": "Stock reconciliation failed",
            })

        available_stock = (
            record["opening_stock"]
            + record["received_quantity"]
        )

        if record["issued_quantity"] > available_stock + 1e-6:

            errors.append({

                "row": index,

                "issue": "Issued quantity exceeds available stock",
            })

        if not math.isclose(
            record["requested_quantity"],
            record["issued_quantity"] + record["unmet_quantity"],
            rel_tol=1e-9,
            abs_tol=1e-6,
        ):

            errors.append({

                "row": index,

                "issue": "Demand fulfilment reconciliation failed",
            })

        previous_closing[key] = record["closing_stock"]

    return {

        "records_checked": len(records),

        "errors_found": len(errors),

        "passed": len(errors) == 0,

        "errors": errors[:10],
    }


# ============================================================
# 5. PROCUREMENT INTEGRITY VALIDATION
# ============================================================

def validate_procurement_integrity(
    inventory: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:

    purchase_orders = inventory["purchase_orders"]

    movements = inventory["movements"]

    master = generate_master_data()

    material_categories = {
        item["item_code"]: item["category"]
        for item in master["materials"]
    }

    receipts_by_po = defaultdict(list)

    purchase_order_lookup = {
        po["po_id"]: po
        for po in purchase_orders
    }

    for movement in movements:

        if movement["movement_type"] == "RECEIPT":

            receipts_by_po[
                movement["reference_id"]
            ].append(movement)

    errors = {

        "missing_receipts": [],

        "duplicate_receipts": [],

        "orphan_receipts": [],

        "receipt_mismatches": [],

        "incompatible_suppliers": [],
    }

    for po in purchase_orders:

        po_id = po["po_id"]

        receipts = receipts_by_po.get(po_id, [])

        if po["status"] == "RECEIVED":

            if len(receipts) == 0:

                errors["missing_receipts"].append(po_id)

            elif len(receipts) > 1:

                errors["duplicate_receipts"].append(po_id)

            else:

                receipt = receipts[0]

                if (
                    not math.isclose(
                        receipt["quantity"],
                        po["ordered_quantity"],
                        rel_tol=1e-9,
                        abs_tol=1e-6,
                    )
                    or receipt["item_code"] != po["item_code"]
                    or receipt["location_code"] != po["location_code"]
                    or receipt.get("supplier_code") != po["supplier_code"]
                    or receipt.get("movement_date") != po.get("receipt_date")
                ):

                    errors["receipt_mismatches"].append(po_id)

        elif len(receipts) > 0:

            errors["receipt_mismatches"].append(po_id)

        category = material_categories.get(
            po["item_code"]
        )

        supported_categories = SUPPLIER_CATEGORIES.get(
            po["supplier_code"],
            [],
        )

        if category not in supported_categories:

            errors["incompatible_suppliers"].append(po_id)

    for po_id in receipts_by_po:

        if po_id not in purchase_order_lookup:

            errors["orphan_receipts"].append(po_id)

    total_errors = sum(
        len(values)
        for values in errors.values()
    )

    return {

        "purchase_orders_checked": len(purchase_orders),

        "receipt_movements_checked": sum(
            len(receipts)
            for receipts in receipts_by_po.values()
        ),

        "errors_found": total_errors,

        "passed": total_errors == 0,

        "errors": errors,
    }


# ============================================================
# 6. STOCK-OUT ANALYSIS
# ============================================================

def analyze_stockouts(
    inventory: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:

    stockout_records = [

        row
        for row in inventory["weekly_inventory"]
        if row["unmet_quantity"] > 0
    ]

    by_material = defaultdict(float)

    by_location = defaultdict(float)

    for row in stockout_records:

        by_material[row["item_code"]] += (
            row["unmet_quantity"]
        )

        by_location[row["location_code"]] += (
            row["unmet_quantity"]
        )

    return {

        "stockout_records": len(stockout_records),

        "total_unmet_quantity": round(
            sum(
                row["unmet_quantity"]
                for row in stockout_records
            ),
            2,
        ),

        "affected_materials": len(by_material),

        "affected_locations": len(by_location),

        "top_materials": sorted(
            by_material.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5],

        "location_breakdown": sorted(
            by_location.items(),
            key=lambda item: item[1],
            reverse=True,
        ),
    }


# ============================================================
# 7. STOCK-OUT EVENT DIAGNOSTICS
# ============================================================

def get_stockout_diagnostics(
    inventory: dict[str, list[dict[str, Any]]],
    limit: int = 15,
) -> list[dict[str, Any]]:

    stockout_records = [

        row
        for row in inventory["weekly_inventory"]
        if row["unmet_quantity"] > 0
    ]

    stockout_records.sort(
        key=lambda row: row["unmet_quantity"],
        reverse=True,
    )

    diagnostic_fields = [

        "week_start",

        "item_code",

        "location_code",

        "opening_stock",

        "received_quantity",

        "requested_quantity",

        "issued_quantity",

        "unmet_quantity",

        "outstanding_quantity",

        "overdue_quantity",

        "dependable_pipeline_quantity",

        "inventory_position",

        "inventory_position_at_start",

        "reorder_point",

        "target_stock",

        "stock_cover_days",

        "stock_cover_days_at_start",

        "days_until_next_delivery",

        "projected_shortage_before_delivery",

        "ordered_quantity",

        "emergency_replenishment",

        "unit",
    ]

    result = []

    for row in stockout_records[:limit]:

        event = {}

        for field in diagnostic_fields:

            value = row.get(field)

            if isinstance(value, float):

                value = round(value, 2)

            event[field] = value

        result.append(event)

    return result


# ============================================================
# 8. PURCHASE ORDER PIPELINE DIAGNOSTICS
# ============================================================

def diagnose_stockout_pipeline(
    inventory: dict[str, list[dict[str, Any]]],
    item_code: str,
    location_code: str,
    week_start: str,
) -> list[dict[str, Any]]:

    event_date = as_date(week_start)

    relevant_orders = []

    for order in inventory["purchase_orders"]:

        if (
            order["item_code"] != item_code
            or order["location_code"] != location_code
        ):

            continue

        order_date = as_date(order["order_date"])

        expected_date = as_date(
            order["expected_arrival_date"]
        )

        actual_date = as_date(
            order["actual_arrival_date"]
        )

        # IMPORTANT:
        # Only show orders that existed at the event date.
        # This prevents future purchase orders leaking
        # into historical diagnostics.

        if order_date <= event_date < actual_date:

            relevant_orders.append({

                "po_id": order["po_id"],

                "supplier_code": order["supplier_code"],

                "order_date": order["order_date"],

                "expected_arrival_date": (
                    order["expected_arrival_date"]
                ),

                "actual_arrival_date": (
                    order["actual_arrival_date"]
                ),

                "ordered_quantity": round(
                    order["ordered_quantity"],
                    2,
                ),

                "expected_lead_time_days": (
                    order["expected_lead_time_days"]
                ),

                "actual_lead_time_days": (
                    order["actual_lead_time_days"]
                ),

                "is_delayed": order["is_delayed"],

                "days_until_arrival": (
                    actual_date - event_date
                ).days,

                "days_past_expected_arrival": max(
                    0,
                    (event_date - expected_date).days,
                ),

                "is_overdue_at_event": (
                    expected_date < event_date
                ),
            })

    return sorted(
        relevant_orders,
        key=lambda order: order["actual_arrival_date"],
    )


# ============================================================
# 9. MAIN EXECUTION
# ============================================================

if __name__ == "__main__":

    inventory = generate_inventory()

    validation = validate_inventory(inventory)

    procurement_validation = validate_procurement_integrity(
        inventory
    )

    stockout_analysis = analyze_stockouts(inventory)

    stockout_diagnostics = get_stockout_diagnostics(
        inventory,
        limit=15,
    )

    pipeline_diagnostics = diagnose_stockout_pipeline(

        inventory,

        item_code="CB-XLPE-1C",

        location_code="GUVNL-VAD",

        week_start="2026-03-02",
    )

    purchase_orders = inventory["purchase_orders"]

    print(
        "GRIDSTOCK AI - START-OF-WEEK INVENTORY & PROCUREMENT"
    )

    print("-" * 60)

    print(
        "Opening balances:",
        len(inventory["opening_balances"]),
    )

    print(
        "Stock movements:",
        len(inventory["movements"]),
    )

    print(
        "Weekly records:",
        len(inventory["weekly_inventory"]),
    )

    print(
        "Purchase orders:",
        len(purchase_orders),
    )

    print(
        "Received orders:",
        sum(
            po["status"] == "RECEIVED"
            for po in purchase_orders
        ),
    )

    print(
        "Outstanding orders:",
        sum(
            po["status"] == "OUTSTANDING"
            for po in purchase_orders
        ),
    )

    print(
        "Delayed orders:",
        sum(
            po["is_delayed"]
            for po in purchase_orders
        ),
    )

    print(
        "Emergency orders:",
        sum(
            po.get("is_emergency", False)
            for po in purchase_orders
        ),
    )

    print("\nINVENTORY VALIDATION:")

    print(validation)

    print("\nPROCUREMENT INTEGRITY VALIDATION:")

    print(procurement_validation)

    print("\nSTOCK-OUT ANALYSIS:")

    print(stockout_analysis)

    print("\nTOP 15 STOCK-OUT EVENTS:")

    for index, event in enumerate(
        stockout_diagnostics,
        start=1,
    ):

        print(f"\nEvent #{index}")

        for field, value in event.items():

            print(f"  {field}: {value}")

    print("\nPURCHASE ORDERS DURING WORST STOCK-OUT EVENT:")

    for order in pipeline_diagnostics:

        print(order)

    print(
        "\nTotal outstanding pipeline quantity:",

        round(
            sum(
                order["ordered_quantity"]
                for order in pipeline_diagnostics
            ),
            2,
        ),
    )

    print(
        "\nTotal stock-out records:",

        sum(
            row["unmet_quantity"] > 0
            for row in inventory["weekly_inventory"]
        ),
    )

    