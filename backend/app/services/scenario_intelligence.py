from __future__ import annotations

from typing import Any
import math

import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

from app.core.dataset_manager import (
    get_dataset_file,
    get_generated_file,
    get_active_dataset,
)

SCENARIO_TYPES = {
    "demand_surge",
    "supplier_delay",
    "emergency_event",
    "budget_constraint",
    "supply_disruption",
}


# ============================================================
# GENERAL HELPERS
# ============================================================

def _load_csv(filename: str, generated: bool = False) -> pd.DataFrame:
    """Load a CSV from the active dataset."""

    filepath = (
        get_generated_file(filename)
        if generated
        else get_dataset_file(filename)
    )

    if not filepath.exists():
        raise FileNotFoundError(
            f"Required file '{filename}' is not available "
            "in the active dataset."
        )

    return pd.read_csv(filepath)


def _get_data_source() -> str:
    dataset = get_active_dataset()

    if dataset.get("type") == "synthetic":
        return "SYNTHETIC"

    return "UPLOADED"


def _get_dataset_information() -> dict:
    dataset = get_active_dataset()

    return {
        "dataset_id": dataset.get("id"),
        "dataset_name": dataset.get("name"),
        "dataset_type": dataset.get("type"),
    }


def _clean_number(
    value: Any,
    default: float = 0.0,
) -> float:
    try:
        number = float(value)

        if not math.isfinite(number):
            return default

        return number

    except (TypeError, ValueError):
        return default


def _clean_string(value: Any) -> str:
    if pd.isna(value):
        return ""

    return str(value).strip()


def _load_data() -> dict[str, pd.DataFrame]:

    forecasts = _load_csv(
        "forecasts.csv",
        generated=True,
    )

    inventory = _load_csv("weekly_inventory.csv")
    purchase_orders = _load_csv("purchase_orders.csv")
    materials = _load_csv("materials.csv")
    locations = _load_csv("locations.csv")
    suppliers = _load_csv("suppliers.csv")

    required_columns = {
        "forecasts": {
            "week_start",
            "item_code",
            "location_code",
            "forecast_quantity",
        },
        "inventory": {
            "week_start",
            "item_code",
            "location_code",
            "closing_stock",
            "reorder_point",
            "target_stock",
            "unit",
        },
        "purchase_orders": {
            "po_id",
            "expected_arrival_date",
            "item_code",
            "location_code",
            "supplier_code",
            "ordered_quantity",
            "status",
        },
        "materials": {
            "item_code",
            "item_name",
            "unit",
            "unit_cost",
            "lead_time_days",
            "criticality",
        },
        "suppliers": {
            "supplier_code",
            "supplier_name",
        },
    }

    frames = {
        "forecasts": forecasts,
        "inventory": inventory,
        "purchase_orders": purchase_orders,
        "materials": materials,
        "locations": locations,
        "suppliers": suppliers,
    }

    for frame_name, columns in required_columns.items():

        missing = columns - set(frames[frame_name].columns)

        if missing:
            raise ValueError(
                f"{frame_name}.csv is missing columns: "
                f"{sorted(missing)}"
            )

    forecasts = forecasts.copy()
    inventory = inventory.copy()
    purchase_orders = purchase_orders.copy()
    materials = materials.copy()
    suppliers = suppliers.copy()

    forecasts["week_start"] = pd.to_datetime(
        forecasts["week_start"],
        errors="coerce",
    )

    inventory["week_start"] = pd.to_datetime(
        inventory["week_start"],
        errors="coerce",
    )

    purchase_orders["expected_arrival_date"] = pd.to_datetime(
        purchase_orders["expected_arrival_date"],
        errors="coerce",
    )

    forecasts["forecast_quantity"] = pd.to_numeric(
        forecasts["forecast_quantity"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    inventory["closing_stock"] = pd.to_numeric(
        inventory["closing_stock"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    inventory["reorder_point"] = pd.to_numeric(
        inventory["reorder_point"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    inventory["target_stock"] = pd.to_numeric(
        inventory["target_stock"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    purchase_orders["ordered_quantity"] = pd.to_numeric(
        purchase_orders["ordered_quantity"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    materials["unit_cost"] = pd.to_numeric(
        materials["unit_cost"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    materials["lead_time_days"] = pd.to_numeric(
        materials["lead_time_days"],
        errors="coerce",
    ).fillna(0).clip(lower=0)

    forecasts = forecasts.dropna(
        subset=["week_start"]
    )

    inventory = inventory.dropna(
        subset=["week_start"]
    )

    if forecasts.empty:
        raise ValueError(
            "No valid forecast records are available."
        )

    if inventory.empty:
        raise ValueError(
            "No valid inventory records are available."
        )

    return {
        "forecasts": forecasts,
        "inventory": inventory,
        "purchase_orders": purchase_orders,
        "materials": materials,
        "locations": locations,
        "suppliers": suppliers,
    }


# ============================================================
# SCENARIO OPTIONS FOR FRONTEND
# ============================================================

def get_scenario_options() -> dict[str, Any]:
    data = _load_data()

    materials = data["materials"]
    locations = data["locations"]
    suppliers = data["suppliers"]
    inventory = data["inventory"]
    forecasts = data["forecasts"]

    latest_snapshot_date = inventory["week_start"].max()

    latest_inventory = inventory[
        inventory["week_start"] == latest_snapshot_date
    ]

    forecast_dates = sorted(
        forecasts["week_start"]
        .dropna()
        .dt.strftime("%Y-%m-%d")
        .unique()
        .tolist()
    )

    material_options = []

    for _, row in materials.sort_values(
        "item_code"
    ).iterrows():

        material_options.append({
            "item_code": _clean_string(row["item_code"]),
            "item_name": _clean_string(row["item_name"]),
            "unit": _clean_string(row["unit"]),
            "unit_cost": _clean_number(row["unit_cost"]),
            "lead_time_days": _clean_number(
                row["lead_time_days"]
            ),
            "criticality": _clean_string(
                row["criticality"]
            ),
        })

    location_options = []

    if "location_code" in locations.columns:

        for _, row in locations.iterrows():

            location_code = _clean_string(
                row["location_code"]
            )

            location_options.append({
                "location_code": location_code,
                "location_name": _clean_string(
                    row.get(
                        "location_name",
                        location_code,
                    )
                ),
            })

    else:

        for code in sorted(
            latest_inventory["location_code"]
            .dropna()
            .unique()
        ):

            location_options.append({
                "location_code": _clean_string(code),
                "location_name": _clean_string(code),
            })

    supplier_options = []

    for _, row in suppliers.sort_values(
        "supplier_code"
    ).iterrows():

        supplier_options.append({
            "supplier_code": _clean_string(
                row["supplier_code"]
            ),
            "supplier_name": _clean_string(
                row["supplier_name"]
            ),
        })

    return {
        "source": _get_data_source(),
        "dataset": _get_dataset_information(),

        "scenario_types": [
            {
                "value": "demand_surge",
                "label": "Demand Surge",
                "description": (
                    "Increase forecast demand by a selected percentage."
                ),
            },
            {
                "value": "supplier_delay",
                "label": "Supplier Delay",
                "description": (
                    "Extend outstanding purchase order arrival dates."
                ),
            },
            {
                "value": "emergency_event",
                "label": "Emergency Event",
                "description": (
                    "Add one-time demand for a selected material and location."
                ),
            },
            {
                "value": "budget_constraint",
                "label": "Budget Constraint",
                "description": (
                    "Limit procurement spending by a selected percentage."
                ),
            },
            {
                "value": "supply_disruption",
                "label": "Supply Disruption",
                "description": (
                    "Remove outstanding purchase orders from a selected supplier."
                ),
            },
        ],

        "materials": material_options,
        "locations": location_options,
        "suppliers": supplier_options,

        "forecast_weeks": forecast_dates,

        "latest_snapshot_date": (
            latest_snapshot_date.strftime("%Y-%m-%d")
        ),

        "forecast_horizon_weeks": len(forecast_dates),

        "assumptions": [
            (
                "All input data is synthetic."
                if _get_data_source() == "SYNTHETIC"
                else "Input data comes from the active uploaded dataset."
            ),
            "Opening inventory uses the latest physical closing stock.",
            "Overdue outstanding purchase orders are excluded from projected receipts.",
            "Dependable pipeline is not added separately to physical stock.",
            "New procurement recommendations are not treated as received stock.",
            "Unmet demand is tracked separately as a recovery requirement.",
        ],
    }


# ============================================================
# INVENTORY SNAPSHOT
# ============================================================

def _get_latest_inventory(
    inventory: pd.DataFrame,
) -> tuple[pd.Timestamp, pd.DataFrame]:

    snapshot_date = inventory["week_start"].max()

    snapshot = inventory[
        inventory["week_start"] == snapshot_date
    ].copy()

    snapshot = snapshot.sort_values(
        ["item_code", "location_code"]
    ).drop_duplicates(
        subset=["item_code", "location_code"],
        keep="last",
    )

    return snapshot_date, snapshot


# ============================================================
# PURCHASE ORDER PROCESSING
# ============================================================


def _prepare_purchase_orders(
    purchase_orders: pd.DataFrame,
    snapshot_date: pd.Timestamp,
) -> tuple[pd.DataFrame, pd.DataFrame]:

    orders = purchase_orders.copy()

    orders["status"] = (
        orders["status"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    excluded_statuses = {
        "RECEIVED",
        "CANCELLED",
        "CANCELED",
        "CLOSED",
        "REJECTED",
        "VOID",
    }

    outstanding = orders[
        ~orders["status"].isin(excluded_statuses)
    ].copy()

    outstanding = outstanding[
        outstanding["expected_arrival_date"].notna()
    ].copy()

    overdue = outstanding[
        outstanding["expected_arrival_date"] < snapshot_date
    ].copy()

    future_orders = outstanding[
        outstanding["expected_arrival_date"] >= snapshot_date
    ].copy()

    return future_orders, overdue



# ============================================================
# PURCHASE ORDER RECEIPT SCHEDULER
# ============================================================

def _schedule_receipts(
    orders: pd.DataFrame,
    forecast_weeks: list[pd.Timestamp],
    supplier_delay_days: int = 0,
    disrupted_supplier: str | None = None,
) -> tuple[dict, list[dict], float]:

    receipts: dict[tuple, float] = {}

    excluded_orders: list[dict] = []

    excluded_quantity = 0.0

    week_ranges = []

    for week in forecast_weeks:

        week_start = pd.Timestamp(week).normalize()

        week_end = week_start + pd.Timedelta(days=6)

        week_ranges.append(
            (week_start, week_end)
        )

    for _, order in orders.iterrows():

        supplier_code = _clean_string(
            order["supplier_code"]
        )

        quantity = _clean_number(
            order["ordered_quantity"]
        )

        if quantity <= 0:
            continue

        if (
            disrupted_supplier
            and supplier_code == disrupted_supplier
        ):

            excluded_quantity += quantity

            excluded_orders.append({
                "po_id": _clean_string(order["po_id"]),
                "supplier_code": supplier_code,
                "item_code": _clean_string(
                    order["item_code"]
                ),
                "location_code": _clean_string(
                    order["location_code"]
                ),
                "quantity": quantity,
                "reason": "Supplier disruption",
            })

            continue

        arrival_date = pd.Timestamp(
            order["expected_arrival_date"]
        ).normalize()

        if supplier_delay_days > 0:

            arrival_date += pd.Timedelta(
                days=supplier_delay_days
            )

        assigned_week = None

        for week_start, week_end in week_ranges:

            if week_start <= arrival_date <= week_end:

                assigned_week = week_start
                break

        if assigned_week is None:
            continue

        key = (
            assigned_week,
            _clean_string(order["item_code"]),
            _clean_string(order["location_code"]),
        )

        receipts[key] = (
            receipts.get(key, 0.0) + quantity
        )

    return receipts, excluded_orders, excluded_quantity


# ============================================================
# CORE INVENTORY PROJECTION ENGINE
# ============================================================

def _run_projection(
    forecasts: pd.DataFrame,
    snapshot: pd.DataFrame,
    materials: pd.DataFrame,
    receipts: dict,
    demand_multiplier: float = 1.0,
    emergency_event: dict | None = None,
    data_source: str = "SYNTHETIC",
) -> dict[str, Any]:

    forecast_weeks = sorted(
        pd.Timestamp(value).normalize()
        for value in forecasts["week_start"].dropna().unique()
    )

    material_lookup = {}

    for _, material in materials.iterrows():

        material_lookup[
            _clean_string(material["item_code"])
        ] = {
            "item_name": _clean_string(
                material["item_name"]
            ),
            "unit": _clean_string(
                material["unit"]
            ),
            "unit_cost": _clean_number(
                material["unit_cost"]
            ),
            "lead_time_days": _clean_number(
                material["lead_time_days"]
            ),
            "criticality": _clean_string(
                material["criticality"]
            ),
        }

    snapshot_lookup = {}

    for _, row in snapshot.iterrows():

        key = (
            _clean_string(row["item_code"]),
            _clean_string(row["location_code"]),
        )

        snapshot_lookup[key] = {
            "opening_stock": _clean_number(
                row["closing_stock"]
            ),
            "reorder_point": _clean_number(
                row["reorder_point"]
            ),
            "target_stock": _clean_number(
                row["target_stock"]
            ),
            "unit": _clean_string(
                row["unit"]
            ),
        }

    forecast_lookup = {}

    for _, row in forecasts.iterrows():

        key = (
            pd.Timestamp(
                row["week_start"]
            ).normalize(),
            _clean_string(row["item_code"]),
            _clean_string(row["location_code"]),
        )

        forecast_lookup[key] = _clean_number(
            row["forecast_quantity"]
        )

    all_keys = set(snapshot_lookup.keys())

    for _, row in forecasts.iterrows():

        all_keys.add((
            _clean_string(row["item_code"]),
            _clean_string(row["location_code"]),
        ))

    projections = []
    weekly_summary = []

    total_demand = 0.0
    total_receipts = 0.0
    total_unmet = 0.0

    total_stockout_weeks = 0

    total_initial_stock = 0.0
    total_final_stock = 0.0

    total_recovery_quantity = 0.0
    total_replenishment_quantity = 0.0

    total_procurement_quantity = 0.0
    total_procurement_cost = 0.0

    for item_code, location_code in sorted(all_keys):

        snapshot_info = snapshot_lookup.get(
            (item_code, location_code),
            {
                "opening_stock": 0.0,
                "reorder_point": 0.0,
                "target_stock": 0.0,
                "unit": "",
            },
        )

        material_info = material_lookup.get(
            item_code,
            {
                "item_name": item_code,
                "unit": snapshot_info["unit"],
                "unit_cost": 0.0,
                "lead_time_days": 0.0,
                "criticality": "",
            },
        )

        stock = snapshot_info["opening_stock"]

        initial_stock = stock

        item_total_demand = 0.0
        item_total_receipts = 0.0
        item_total_unmet = 0.0

        item_stockout_weeks = 0

        item_projection_rows = []

        # ----------------------------------------------------
        # Weekly inventory simulation
        # ----------------------------------------------------

        for week in forecast_weeks:

            week_key = (
                week,
                item_code,
                location_code,
            )

            base_demand = forecast_lookup.get(
                week_key,
                0.0,
            )

            demand = base_demand * demand_multiplier

            emergency_demand = 0.0

            if emergency_event:

                if (
                    item_code == emergency_event["item_code"]
                    and location_code == emergency_event["location_code"]
                    and week == emergency_event["week_start"]
                ):

                    emergency_demand = emergency_event[
                        "quantity"
                    ]

            demand += emergency_demand

            receipt_quantity = receipts.get(
                (week, item_code, location_code),
                0.0,
            )

            opening_stock = stock

            available_stock = (
                opening_stock + receipt_quantity
            )

            unmet_demand = max(
                0.0,
                demand - available_stock,
            )

            closing_stock = max(
                0.0,
                available_stock - demand,
            )

            if unmet_demand > 0:
                item_stockout_weeks += 1

            projection_row = {
                "week_start": week.strftime("%Y-%m-%d"),
                "item_code": item_code,
                "item_name": material_info["item_name"],
                "location_code": location_code,

                "opening_stock": round(
                    opening_stock, 2
                ),

                "forecast_demand": round(
                    base_demand, 2
                ),

                "projected_demand": round(
                    demand, 2
                ),

                "emergency_demand": round(
                    emergency_demand, 2
                ),

                "scheduled_receipts": round(
                    receipt_quantity, 2
                ),

                "available_stock": round(
                    available_stock, 2
                ),

                "unmet_demand": round(
                    unmet_demand, 2
                ),

                "closing_stock": round(
                    closing_stock, 2
                ),

                "reorder_point": round(
                    snapshot_info["reorder_point"], 2
                ),

                "target_stock": round(
                    snapshot_info["target_stock"], 2
                ),

                "unit": material_info["unit"],
                "source": data_source,
            }

            projections.append(projection_row)

            item_projection_rows.append(projection_row)

            item_total_demand += demand
            item_total_receipts += receipt_quantity
            item_total_unmet += unmet_demand

            total_demand += demand
            total_receipts += receipt_quantity
            total_unmet += unmet_demand

            stock = closing_stock

        # ----------------------------------------------------
        # Corrected procurement calculation
        # ----------------------------------------------------

        target_stock = snapshot_info["target_stock"]

        # Quantity of demand that could not be fulfilled
        # during the simulated forecast horizon.
        recovery_quantity = item_total_unmet

        # Additional inventory needed to restore target stock
        # after accounting for the simulated demand and receipts.
        replenishment_quantity = max(
            0.0,
            target_stock - stock,
        )

        # Total procurement must account for both requirements.
        procurement_quantity = (
            recovery_quantity + replenishment_quantity
        )

        procurement_cost = (
            procurement_quantity
            * material_info["unit_cost"]
        )

        # Add procurement metrics to the final weekly record
        # for this item and location.
        if item_projection_rows:

            last_projection = item_projection_rows[-1]

            last_projection["recovery_quantity"] = round(
                recovery_quantity, 2
            )

            last_projection["replenishment_quantity"] = round(
                replenishment_quantity, 2
            )

            last_projection[
                "recommended_procurement_quantity"
            ] = round(
                procurement_quantity, 2
            )

            last_projection[
                "estimated_procurement_cost"
            ] = round(
                procurement_cost, 2
            )

        # ----------------------------------------------------
        # Aggregate totals
        # ----------------------------------------------------

        total_initial_stock += initial_stock
        total_final_stock += stock

        total_recovery_quantity += recovery_quantity

        total_replenishment_quantity += (
            replenishment_quantity
        )

        total_procurement_quantity += (
            procurement_quantity
        )

        total_procurement_cost += procurement_cost

        total_stockout_weeks += item_stockout_weeks

        # ----------------------------------------------------
        # Item-location summary
        # ----------------------------------------------------

        weekly_summary.append({

            "item_code": item_code,

            "item_name": material_info["item_name"],

            "location_code": location_code,

            "opening_stock": round(
                initial_stock, 2
            ),

            "total_projected_demand": round(
                item_total_demand, 2
            ),

            "total_scheduled_receipts": round(
                item_total_receipts, 2
            ),

            "total_unmet_demand": round(
                item_total_unmet, 2
            ),

            "projected_closing_stock": round(
                stock, 2
            ),

            "stockout_weeks": item_stockout_weeks,

            "recovery_quantity": round(
                recovery_quantity, 2
            ),

            "replenishment_quantity": round(
                replenishment_quantity, 2
            ),

            "recommended_procurement_quantity": round(
                procurement_quantity, 2
            ),

            "estimated_procurement_cost": round(
                procurement_cost, 2
            ),

            "unit": material_info["unit"],

            "unit_cost": round(
                material_info["unit_cost"], 2
            ),

            "criticality": material_info["criticality"],
        })

    # --------------------------------------------------------
    # Projection result
    # --------------------------------------------------------

    return {
        "weekly_projection": projections,

        "item_location_summary": weekly_summary,

        "summary": {

            "total_opening_stock": round(
                total_initial_stock, 2
            ),

            "total_projected_demand": round(
                total_demand, 2
            ),

            "total_scheduled_receipts": round(
                total_receipts, 2
            ),

            "total_unmet_demand": round(
                total_unmet, 2
            ),

            "total_projected_closing_stock": round(
                total_final_stock, 2
            ),

            "stockout_item_location_weeks": (
                total_stockout_weeks
            ),

            "total_recovery_quantity": round(
                total_recovery_quantity, 2
            ),

            "total_replenishment_quantity": round(
                total_replenishment_quantity, 2
            ),

            "recommended_procurement_quantity": round(
                total_procurement_quantity, 2
            ),

            "estimated_procurement_cost": round(
                total_procurement_cost, 2
            ),
        },
    }


# ============================================================
# BUDGET CONSTRAINT ENGINE
# ============================================================

def _apply_budget_constraint(
    item_location_summary: list[dict],
    budget_limit: float,
) -> dict[str, Any]:

    rows = [
        dict(row)
        for row in item_location_summary
    ]

    original_cost = sum(
        row["estimated_procurement_cost"]
        for row in rows
    )

    remaining_budget = max(
        0.0,
        budget_limit,
    )

    criticality_priority = {
        "VITAL": 0,
        "ESSENTIAL": 1,
        "DESIRABLE": 2,
    }

    # Vital materials receive priority, followed by Essential
    # and then Desirable materials.
    rows.sort(
        key=lambda item: (
            criticality_priority.get(
                str(
                    item.get("criticality", "")
                ).upper(),
                3,
            ),
            -item["estimated_procurement_cost"],
        )
    )

    for row in rows:

        requested_quantity = _clean_number(
            row["recommended_procurement_quantity"]
        )

        unit_cost = _clean_number(
            row["unit_cost"]
        )

        requested_cost = (
            requested_quantity * unit_cost
        )

        if unit_cost <= 0:

            approved_quantity = requested_quantity
            approved_cost = 0.0

        else:

            affordable_quantity = (
                remaining_budget / unit_cost
            )

            approved_quantity = min(
                requested_quantity,
                affordable_quantity,
            )

            approved_cost = (
                approved_quantity * unit_cost
            )

        remaining_budget = max(
            0.0,
            remaining_budget - approved_cost,
        )

        row["unconstrained_procurement_quantity"] = round(
            requested_quantity, 2
        )

        row["unconstrained_procurement_cost"] = round(
            requested_cost, 2
        )

        row["approved_procurement_quantity"] = round(
            approved_quantity, 2
        )

        row["approved_procurement_cost"] = round(
            approved_cost, 2
        )

        row["recommended_procurement_quantity"] = round(
            approved_quantity, 2
        )

        row["estimated_procurement_cost"] = round(
            approved_cost, 2
        )

        row["deferred_procurement_quantity"] = round(
            max(
                0.0,
                requested_quantity - approved_quantity,
            ),
            2,
        )

    approved_quantity = sum(
        row["recommended_procurement_quantity"]
        for row in rows
    )

    approved_cost = sum(
        row["estimated_procurement_cost"]
        for row in rows
    )

    deferred_quantity = sum(
        row["deferred_procurement_quantity"]
        for row in rows
    )

    return {
        "item_location_summary": rows,

        "budget": {

            "budget_limit": round(
                budget_limit, 2
            ),

            "unconstrained_procurement_cost": round(
                original_cost, 2
            ),

            "approved_procurement_cost": round(
                approved_cost, 2
            ),

            "remaining_budget": round(
                max(
                    0.0,
                    budget_limit - approved_cost,
                ),
                2,
            ),

            "deferred_procurement_quantity": round(
                deferred_quantity, 2
            ),

            "approved_procurement_quantity": round(
                approved_quantity, 2
            ),
        },
    }


# ============================================================
# COMPARISON HELPERS
# ============================================================

def _calculate_change(
    baseline: float,
    scenario: float,
) -> dict[str, float]:

    difference = scenario - baseline

    percentage = (
        (difference / abs(baseline)) * 100
        if baseline != 0
        else (
            100.0 if scenario > 0 else 0.0
        )
    )

    return {
        "baseline": round(baseline, 2),

        "scenario": round(scenario, 2),

        "difference": round(difference, 2),

        "percentage_change": round(
            percentage, 2
        ),
    }


# ============================================================
# MAIN SCENARIO SIMULATION ENGINE
# ============================================================

def simulate_scenario(
    payload: dict[str, Any],
) -> dict[str, Any]:

    data = _load_data()

    data_source = _get_data_source()
    dataset_information = _get_dataset_information()

    forecasts = data["forecasts"].copy()
    inventory = data["inventory"].copy()
    purchase_orders = data["purchase_orders"].copy()
    materials = data["materials"].copy()
    suppliers = data["suppliers"].copy()

    scenario_type = _clean_string(
        payload.get("scenario_type", "")
    ).lower()

    if scenario_type not in SCENARIO_TYPES:

        raise ValueError(
            "Invalid scenario_type. Choose one of: "
            + ", ".join(sorted(SCENARIO_TYPES))
        )

    # --------------------------------------------------------
    # Snapshot and forecast period
    # --------------------------------------------------------

    snapshot_date, snapshot = _get_latest_inventory(
        inventory
    )

    forecast_weeks = sorted(
        pd.Timestamp(value).normalize()
        for value in forecasts["week_start"].dropna().unique()
    )

    if not forecast_weeks:

        raise ValueError(
            "No forecast weeks are available."
        )

    if not snapshot_date < forecast_weeks[0]:

        raise ValueError(
            "The latest inventory snapshot must precede "
            "the forecast horizon."
        )

    future_orders, overdue_orders = (
        _prepare_purchase_orders(
            purchase_orders,
            snapshot_date,
        )
    )

    # --------------------------------------------------------
    # Default scenario parameters
    # --------------------------------------------------------

    demand_multiplier = 1.0

    supplier_delay_days = 0

    disrupted_supplier = None

    emergency_event = None

    budget_reduction_pct = 0.0

    scenario_parameters: dict[str, Any] = {}

    # ========================================================
    # 1. DEMAND SURGE
    # ========================================================

    if scenario_type == "demand_surge":

        surge_pct = _clean_number(
            payload.get("demand_increase_pct", 25)
        )

        if surge_pct < 0 or surge_pct > 300:

            raise ValueError(
                "demand_increase_pct must be between 0 and 300."
            )

        demand_multiplier = (
            1 + surge_pct / 100
        )

        scenario_parameters = {
            "demand_increase_pct": round(
                surge_pct, 2
            ),

            "demand_multiplier": round(
                demand_multiplier, 3
            ),
        }

    # ========================================================
    # 2. SUPPLIER DELAY
    # ========================================================

    elif scenario_type == "supplier_delay":

        supplier_delay_days = int(
            _clean_number(
                payload.get("delay_days", 10)
            )
        )

        if (
            supplier_delay_days < 0
            or supplier_delay_days > 180
        ):

            raise ValueError(
                "delay_days must be between 0 and 180."
            )

        scenario_parameters = {
            "delay_days": supplier_delay_days,
        }

    # ========================================================
    # 3. EMERGENCY EVENT
    # ========================================================

    elif scenario_type == "emergency_event":

        item_code = _clean_string(
            payload.get("item_code")
        )

        location_code = _clean_string(
            payload.get("location_code")
        )

        quantity = _clean_number(
            payload.get("additional_demand")
        )

        event_week_raw = _clean_string(
            payload.get("event_week")
        )

        if not item_code or not location_code:

            raise ValueError(
                "item_code and location_code are required "
                "for an emergency event."
            )

        if quantity <= 0:

            raise ValueError(
                "additional_demand must be greater than zero."
            )

        if not event_week_raw:

            event_week = forecast_weeks[0]

        else:

            try:

                event_week = pd.Timestamp(
                    event_week_raw
                ).normalize()

            except Exception as exc:

                raise ValueError(
                    "event_week must be a valid date "
                    "in YYYY-MM-DD format."
                ) from exc

        if event_week not in forecast_weeks:

            raise ValueError(
                "event_week must match one of the "
                "available forecast weeks."
            )

        
        valid_item_location_pairs = set(
            zip(
                forecasts["item_code"].astype(str).str.strip(),
                forecasts["location_code"].astype(str).str.strip(),
            )
        )

        if (item_code, location_code) not in valid_item_location_pairs:
            raise ValueError(
                "The selected item-location combination "
                "does not exist in the forecast data."
            )


        emergency_event = {
            "item_code": item_code,
            "location_code": location_code,
            "quantity": quantity,
            "week_start": event_week,
        }

        scenario_parameters = {
            "item_code": item_code,

            "location_code": location_code,

            "additional_demand": round(
                quantity, 2
            ),

            "event_week": event_week.strftime(
                "%Y-%m-%d"
            ),
        }

    # ========================================================
    # 4. BUDGET CONSTRAINT
    # ========================================================

    elif scenario_type == "budget_constraint":

        budget_reduction_pct = _clean_number(
            payload.get("budget_reduction_pct", 20)
        )

        if (
            budget_reduction_pct < 0
            or budget_reduction_pct > 100
        ):

            raise ValueError(
                "budget_reduction_pct must be between 0 and 100."
            )

        scenario_parameters = {
            "budget_reduction_pct": round(
                budget_reduction_pct, 2
            ),
        }

    # ========================================================
    # 5. SUPPLY DISRUPTION
    # ========================================================

    elif scenario_type == "supply_disruption":

        disrupted_supplier = _clean_string(
            payload.get("supplier_code")
        )

        if not disrupted_supplier:

            raise ValueError(
                "supplier_code is required "
                "for a supply disruption."
            )

        valid_suppliers = set(
            suppliers["supplier_code"]
            .astype(str)
            .str.strip()
        )

        if disrupted_supplier not in valid_suppliers:

            raise ValueError(
                "Selected supplier_code does not exist."
            )

        supplier_match = suppliers[
            suppliers["supplier_code"]
            .astype(str)
            .str.strip()
            == disrupted_supplier
        ]

        supplier_name = _clean_string(
            supplier_match.iloc[0]["supplier_name"]
        )

        scenario_parameters = {
            "supplier_code": disrupted_supplier,
            "supplier_name": supplier_name,
        }

    # ========================================================
    # BASELINE PURCHASE ORDER RECEIPTS
    # ========================================================

    baseline_receipts, _, _ = _schedule_receipts(
        future_orders,
        forecast_weeks,
    )

    # ========================================================
    # SCENARIO PURCHASE ORDER RECEIPTS
    # ========================================================

    (
        scenario_receipts,
        excluded_orders,
        excluded_quantity,
    ) = _schedule_receipts(
        future_orders,
        forecast_weeks,
        supplier_delay_days=supplier_delay_days,
        disrupted_supplier=disrupted_supplier,
    )

    # ========================================================
    # RUN BASELINE PROJECTION
    # ========================================================

    baseline_result = _run_projection(
        forecasts=forecasts,
        snapshot=snapshot,
        materials=materials,
        receipts=baseline_receipts,
        data_source=data_source,
    )

    # ========================================================
    # RUN SCENARIO PROJECTION
    # ========================================================

    scenario_result = _run_projection(
        forecasts=forecasts,
        snapshot=snapshot,
        materials=materials,
        receipts=scenario_receipts,
        demand_multiplier=demand_multiplier,
        emergency_event=emergency_event,
        data_source=data_source,
    )

    baseline_summary = baseline_result["summary"]

    scenario_summary = scenario_result["summary"]

    # ========================================================
    # APPLY BUDGET CONSTRAINT
    # ========================================================

    budget_result = None

    if scenario_type == "budget_constraint":

        unconstrained_cost = scenario_summary[
            "estimated_procurement_cost"
        ]

        budget_limit = unconstrained_cost * (
            1 - budget_reduction_pct / 100
        )

        budget_result = _apply_budget_constraint(
            scenario_result["item_location_summary"],
            budget_limit,
        )

        scenario_result["item_location_summary"] = (
            budget_result["item_location_summary"]
        )

        # Update aggregate procurement metrics to reflect
        # the approved budget allocation.
        scenario_summary[
            "recommended_procurement_quantity"
        ] = budget_result["budget"][
            "approved_procurement_quantity"
        ]

        scenario_summary[
            "estimated_procurement_cost"
        ] = budget_result["budget"][
            "approved_procurement_cost"
        ]

        # Keep the final weekly projection's procurement
        # recommendations consistent with the budget result.
        approved_lookup = {
            (
                row["item_code"],
                row["location_code"],
            ): row
            for row in scenario_result[
                "item_location_summary"
            ]
        }

        for projection in scenario_result[
            "weekly_projection"
        ]:

            key = (
                projection["item_code"],
                projection["location_code"],
            )

            approved_row = approved_lookup.get(key)

            if approved_row:

                projection[
                    "recommended_procurement_quantity"
                ] = approved_row[
                    "recommended_procurement_quantity"
                ]

                projection[
                    "estimated_procurement_cost"
                ] = approved_row[
                    "estimated_procurement_cost"
                ]

    # ========================================================
    # ITEM-LOCATION COMPARISON
    # ========================================================

    baseline_items = {
        (
            row["item_code"],
            row["location_code"],
        ): row
        for row in baseline_result[
            "item_location_summary"
        ]
    }

    scenario_items = {
        (
            row["item_code"],
            row["location_code"],
        ): row
        for row in scenario_result[
            "item_location_summary"
        ]
    }

    item_comparison = []

    for key in sorted(
        set(baseline_items) | set(scenario_items)
    ):

        baseline_row = baseline_items.get(
            key, {}
        )

        scenario_row = scenario_items.get(
            key, {}
        )

        item_comparison.append({

            "item_code": key[0],

            "item_name": scenario_row.get(
                "item_name",
                baseline_row.get("item_name", key[0]),
            ),

            "location_code": key[1],

            "baseline_unmet_demand": baseline_row.get(
                "total_unmet_demand", 0
            ),

            "scenario_unmet_demand": scenario_row.get(
                "total_unmet_demand", 0
            ),

            "baseline_closing_stock": baseline_row.get(
                "projected_closing_stock", 0
            ),

            "scenario_closing_stock": scenario_row.get(
                "projected_closing_stock", 0
            ),

            "baseline_recovery_quantity": baseline_row.get(
                "recovery_quantity", 0
            ),

            "scenario_recovery_quantity": scenario_row.get(
                "recovery_quantity", 0
            ),

            "baseline_replenishment_quantity": baseline_row.get(
                "replenishment_quantity", 0
            ),

            "scenario_replenishment_quantity": scenario_row.get(
                "replenishment_quantity", 0
            ),

            "baseline_procurement_quantity": baseline_row.get(
                "recommended_procurement_quantity", 0
            ),

            "scenario_procurement_quantity": scenario_row.get(
                "recommended_procurement_quantity", 0
            ),

            "scenario_procurement_cost": scenario_row.get(
                "estimated_procurement_cost", 0
            ),

            "unit": scenario_row.get(
                "unit",
                baseline_row.get("unit", ""),
            ),

            "criticality": scenario_row.get(
                "criticality",
                baseline_row.get("criticality", ""),
            ),
        })

    # ========================================================
    # BASELINE VS SCENARIO COMPARISON
    # ========================================================

    comparison = {

        "projected_demand": _calculate_change(
            baseline_summary["total_projected_demand"],
            scenario_summary["total_projected_demand"],
        ),

        "scheduled_receipts": _calculate_change(
            baseline_summary["total_scheduled_receipts"],
            scenario_summary["total_scheduled_receipts"],
        ),

        "unmet_demand": _calculate_change(
            baseline_summary["total_unmet_demand"],
            scenario_summary["total_unmet_demand"],
        ),

        "projected_closing_stock": _calculate_change(
            baseline_summary["total_projected_closing_stock"],
            scenario_summary["total_projected_closing_stock"],
        ),

        "stockout_item_location_weeks": _calculate_change(
            baseline_summary["stockout_item_location_weeks"],
            scenario_summary["stockout_item_location_weeks"],
        ),

        "recovery_quantity": _calculate_change(
            baseline_summary["total_recovery_quantity"],
            scenario_summary["total_recovery_quantity"],
        ),

        "replenishment_quantity": _calculate_change(
            baseline_summary["total_replenishment_quantity"],
            scenario_summary["total_replenishment_quantity"],
        ),

        "procurement_quantity": _calculate_change(
            baseline_summary["recommended_procurement_quantity"],
            scenario_summary["recommended_procurement_quantity"],
        ),

        "procurement_cost": _calculate_change(
            baseline_summary["estimated_procurement_cost"],
            scenario_summary["estimated_procurement_cost"],
        ),
    }

    # ========================================================
    # SCENARIO-SPECIFIC IMPACT
    # ========================================================

    scenario_impact = {}

    if scenario_type == "supplier_delay":

        scenario_impact = {
            "delayed_purchase_orders": int(
                len(future_orders)
            ),

            "delay_days": supplier_delay_days,
        }

    elif scenario_type == "supply_disruption":

        scenario_impact = {

            "disrupted_supplier_code": disrupted_supplier,

            "excluded_purchase_order_count": len(
                excluded_orders
            ),

            "excluded_purchase_order_quantity": round(
                excluded_quantity, 2
            ),

            "excluded_purchase_orders": excluded_orders,
        }

    elif scenario_type == "emergency_event":

        scenario_impact = {

            "additional_demand": round(
                emergency_event["quantity"], 2
            ),

            "affected_item": emergency_event["item_code"],

            "affected_location": emergency_event[
                "location_code"
            ],

            "event_week": emergency_event[
                "week_start"
            ].strftime("%Y-%m-%d"),
        }

    elif scenario_type == "demand_surge":

        scenario_impact = {

            "demand_increase_pct": round(
                (demand_multiplier - 1) * 100,
                2,
            ),

            "additional_projected_demand": round(
                scenario_summary["total_projected_demand"]
                - baseline_summary["total_projected_demand"],
                2,
            ),
        }

    elif scenario_type == "budget_constraint":

        scenario_impact = budget_result["budget"]

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {

        "source": data_source,

        "dataset": dataset_information,

        "scenario_type": scenario_type,

        "scenario_parameters": scenario_parameters,

        "simulation_period": {

            "snapshot_date": snapshot_date.strftime(
                "%Y-%m-%d"
            ),

            "forecast_start": forecast_weeks[0].strftime(
                "%Y-%m-%d"
            ),

            "forecast_end": forecast_weeks[-1].strftime(
                "%Y-%m-%d"
            ),

            "forecast_horizon_weeks": len(
                forecast_weeks
            ),
        },

        "baseline": baseline_summary,

        "scenario": scenario_summary,

        "comparison": comparison,

        "scenario_impact": scenario_impact,

        "overdue_purchase_orders": {

            "count": int(len(overdue_orders)),

            "quantity": round(
                overdue_orders["ordered_quantity"].sum()
                if not overdue_orders.empty
                else 0,
                2,
            ),

            "excluded_from_projected_receipts": True,
        },

        "item_location_comparison": item_comparison,

        "baseline_weekly_projection": baseline_result[
            "weekly_projection"
        ],

        "scenario_weekly_projection": scenario_result[
            "weekly_projection"
        ],

        "scenario_item_location_summary": scenario_result[
            "item_location_summary"
        ],

        "assumptions": [

            (
                "All data and simulation outputs are synthetic."
                if data_source == "SYNTHETIC"
                else "Simulation uses the active uploaded dataset; results are modeled estimates, not actual outcomes."
            ),

            "Both projections start from the same latest physical closing-stock snapshot.",

            "Only outstanding purchase orders with expected arrival dates on or after the snapshot date are scheduled.",

            "Overdue purchase orders are reported separately and excluded from scheduled receipts.",

            "Dependable pipeline quantity is not added separately to physical closing stock.",

            "Supplier disruption removes the selected supplier's outstanding purchase orders from projected receipts.",

            "Supplier delay shifts outstanding purchase order arrival dates by the configured number of days.",

            "Demand surge applies the configured percentage to every forecast record.",

            "Emergency event demand is added once in the selected forecast week.",

            "Recovery quantity represents demand that could not be fulfilled during the forecast horizon.",

            "Replenishment quantity represents additional stock needed to reach target stock after the forecast horizon.",

            "Total procurement requirement equals recovery quantity plus replenishment quantity.",

            "New procurement recommendations are not treated as received stock.",

            "Budget constraint limits recommended procurement spending and prioritises Vital, Essential, then Desirable materials.",

            "Budget constraint does not retroactively change projected stock or unmet demand.",
        ],
    }