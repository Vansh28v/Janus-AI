"""
GRIDSTOCK AI
Dataset-Aware Inventory Optimization Engine

Generates inventory redistribution and
replenishment recommendations.

Priority:
1. Identify recipient shortages.
2. Identify transferable surplus at other locations.
3. Recommend redistribution first.
4. Recommend procurement for remaining deficits.

Quantity rules:
- unit: whole numbers
- kit: whole numbers
- meter: up to 2 decimal places

Does not modify the inventory simulation.
"""

import math

import pandas as pd

from app.core.dataset_manager import (
    get_dataset_file,
    get_active_dataset,
)


# ------------------------------------------------------------
# DATASET INFORMATION
# ------------------------------------------------------------

def get_dataset_information():

    dataset = get_active_dataset()

    return {
        "dataset_id": dataset.get("id"),
        "dataset_name": dataset.get("name"),
        "dataset_type": dataset.get("type"),
    }


def get_data_source():

    dataset = get_active_dataset()

    if dataset.get("type") == "synthetic":
        return "SYNTHETIC"

    return "UPLOADED"


# ------------------------------------------------------------
# DATA LOADING
# ------------------------------------------------------------

def load_inventory_snapshot() -> pd.DataFrame:
    """Load the latest inventory snapshot from the active dataset."""

    filepath = get_dataset_file("weekly_inventory.csv")

    if not filepath.exists():
        raise FileNotFoundError(
            "weekly_inventory.csv not found in the active dataset."
        )

    df = pd.read_csv(filepath)

    if df.empty:
        raise ValueError(
            "Inventory dataset is empty."
        )

    required_columns = [
        "week_start",
        "item_code",
        "location_code",
        "closing_stock",
        "inventory_position",
        "reorder_point",
        "target_stock",
        "unmet_quantity",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Inventory dataset is missing required columns: "
            f"{missing_columns}"
        )

    df["week_start"] = (
        df["week_start"].astype(str)
    )

    latest_week = df["week_start"].max()

    snapshot = df[
        df["week_start"] == latest_week
    ].copy()

    numeric_columns = [
        "closing_stock",
        "inventory_position",
        "dependable_pipeline_quantity",
        "reorder_point",
        "target_stock",
        "unmet_quantity",
        "stock_cover_days",
    ]

    for column in numeric_columns:

        if column in snapshot.columns:

            snapshot[column] = pd.to_numeric(
                snapshot[column],
                errors="coerce",
            ).fillna(0)

    return snapshot


# ------------------------------------------------------------
# QUANTITY PRECISION
# ------------------------------------------------------------

def get_quantity_precision(unit: str) -> int:
    """
    Return the permitted decimal precision.

    Indivisible materials use whole numbers.
    Meter-based materials allow two decimal places.
    """

    if str(unit).strip().lower() == "meter":
        return 2

    return 0


def round_quantity_down(
    quantity: float,
    precision: int,
) -> float:
    """Round down to avoid transferring unavailable stock."""

    factor = 10 ** precision

    return math.floor(
        quantity * factor + 1e-9
    ) / factor


def round_quantity_up(
    quantity: float,
    precision: int,
) -> float:
    """Round up to ensure the recommended quantity covers the deficit."""

    if quantity <= 0:
        return 0.0

    factor = 10 ** precision

    return math.ceil(
        quantity * factor - 1e-9
    ) / factor


# ------------------------------------------------------------
# PRIORITY CLASSIFICATION
# ------------------------------------------------------------

def determine_priority(
    unmet_quantity: float,
    inventory_position: float,
    reorder_point: float,
) -> str:
    """
    Classify recommendation urgency.

    CRITICAL: Existing unmet demand.
    HIGH: Inventory position at or below reorder point.
    MEDIUM: Below target stock but above reorder point.
    """

    if unmet_quantity > 0:
        return "CRITICAL"

    if inventory_position <= reorder_point:
        return "HIGH"

    return "MEDIUM"
# ------------------------------------------------------------
# OPTIMIZATION ENGINE
# ------------------------------------------------------------

def generate_optimization_recommendations() -> dict:
    """
    Generate redistribution and procurement recommendations.

    Donor surplus:
        Inventory position above target stock,
        limited by physically available closing stock.

    Recipient deficit:
        Target stock minus inventory position.

    Redistribution is prioritized before procurement.
    """

    snapshot = load_inventory_snapshot()

    recommendations = []

    data_source = get_data_source()

    # Process every material independently.
    for item_code, material_group in snapshot.groupby(
        "item_code"
    ):

        locations = material_group.to_dict(
            orient="records"
        )

        donors = []
        recipients = []

        # ----------------------------------------------------
        # IDENTIFY DONORS AND RECIPIENTS
        # ----------------------------------------------------

        for record in locations:

            location_code = record["location_code"]

            unit = str(
                record.get("unit", "unit")
            ).strip().lower()

            precision = get_quantity_precision(unit)

            closing_stock = max(
                0.0,
                float(record["closing_stock"]),
            )

            inventory_position = float(
                record["inventory_position"]
            )

            reorder_point = float(
                record["reorder_point"]
            )

            target_stock = float(
                record["target_stock"]
            )

            unmet_quantity = max(
                0.0,
                float(record["unmet_quantity"]),
            )

            # ------------------------------------------------
            # DONOR SURPLUS
            # ------------------------------------------------
            #
            # Inventory position includes dependable pipeline.
            # This protects the donor's target stock after
            # accounting for incoming supply.
            #
            # However, transfers cannot exceed physical stock.
            # ------------------------------------------------

            position_surplus = max(
                0.0,
                inventory_position - target_stock,
            )

            transferable_surplus = min(
                closing_stock,
                position_surplus,
            )

            transferable_surplus = round_quantity_down(
                transferable_surplus,
                precision,
            )

            if transferable_surplus > 0:

                donors.append({
                    "location_code": location_code,
                    "surplus": transferable_surplus,
                    "available_stock": closing_stock,
                    "inventory_position": inventory_position,
                    "target_stock": target_stock,
                    "unit": unit,
                })

            # ------------------------------------------------
            # RECIPIENT DEFICIT
            # ------------------------------------------------

            inventory_deficit = max(
                0.0,
                target_stock - inventory_position,
            )

            inventory_deficit = round_quantity_up(
                inventory_deficit,
                precision,
            )

            if inventory_deficit > 0:

                priority = determine_priority(
                    unmet_quantity,
                    inventory_position,
                    reorder_point,
                )

                recipients.append({
                    "location_code": location_code,
                    "deficit": inventory_deficit,
                    "inventory_position": inventory_position,
                    "reorder_point": reorder_point,
                    "target_stock": target_stock,
                    "unmet_quantity": unmet_quantity,
                    "priority": priority,
                    "unit": unit,
                    "precision": precision,
                })

        # ----------------------------------------------------
        # SORT DONORS AND RECIPIENTS
        # ----------------------------------------------------

        donors.sort(
            key=lambda item: item["surplus"],
            reverse=True,
        )

        priority_order = {
            "CRITICAL": 0,
            "HIGH": 1,
            "MEDIUM": 2,
        }

        recipients.sort(
            key=lambda item: (
                priority_order[item["priority"]],
                -item["unmet_quantity"],
                -item["deficit"],
            )
        )

        # ----------------------------------------------------
        # REDISTRIBUTION FIRST
        # ----------------------------------------------------

        for recipient in recipients:

            for donor in donors:

                if recipient["deficit"] <= 0:
                    break

                if donor["surplus"] <= 0:
                    continue

                # A location cannot transfer stock to itself.
                if (
                    donor["location_code"]
                    == recipient["location_code"]
                ):
                    continue

                precision = recipient["precision"]

                transfer_quantity = min(
                    donor["surplus"],
                    recipient["deficit"],
                )

                transfer_quantity = round_quantity_down(
                    transfer_quantity,
                    precision,
                )

                if transfer_quantity <= 0:
                    continue

                recommendations.append({
                    "item_code": item_code,
                    "unit": recipient["unit"],
                    "recommendation_type": "REDISTRIBUTION",
                    "priority": recipient["priority"],
                    "from_location": donor["location_code"],
                    "to_location": recipient["location_code"],
                    "recommended_quantity": transfer_quantity,
                    "reason": (
                        "Transfer available surplus stock "
                        "to a location with an inventory deficit."
                    ),
                    "source": data_source,
                })

                # Update remaining donor surplus.
                donor["surplus"] = round_quantity_down(
                    donor["surplus"] - transfer_quantity,
                    precision,
                )

                # Update remaining recipient deficit.
                recipient["deficit"] = round_quantity_up(
                    max(
                        0.0,
                        recipient["deficit"] - transfer_quantity,
                    ),
                    precision,
                )

            # ------------------------------------------------
            # PROCUREMENT FOR REMAINING DEFICIT
            # ------------------------------------------------

            if recipient["deficit"] > 0:

                procurement_quantity = round_quantity_up(
                    recipient["deficit"],
                    recipient["precision"],
                )

                if procurement_quantity <= 0:
                    continue

                recommendations.append({
                    "item_code": item_code,
                    "unit": recipient["unit"],
                    "recommendation_type": "PROCUREMENT",
                    "priority": recipient["priority"],
                    "from_location": None,
                    "to_location": recipient["location_code"],
                    "recommended_quantity": procurement_quantity,
                    "reason": (
                        "Remaining inventory deficit after "
                        "available redistribution."
                    ),
                    "source": data_source,
                })
                    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    redistribution = [
        item
        for item in recommendations
        if item["recommendation_type"] == "REDISTRIBUTION"
    ]

    procurement = [
        item
        for item in recommendations
        if item["recommendation_type"] == "PROCUREMENT"
    ]

    priority_counts = {
        "CRITICAL": sum(
            1 for item in recommendations
            if item["priority"] == "CRITICAL"
        ),

        "HIGH": sum(
            1 for item in recommendations
            if item["priority"] == "HIGH"
        ),

        "MEDIUM": sum(
            1 for item in recommendations
            if item["priority"] == "MEDIUM"
        ),
    }

    return {
        "latest_week": snapshot["week_start"].max(),

        "source": data_source,

        "dataset": get_dataset_information(),

        "total_recommendations": len(
            recommendations
        ),

        "redistribution_recommendations": len(
            redistribution
        ),

        "procurement_recommendations": len(
            procurement
        ),

        "total_redistribution_quantity": round(
            sum(
                item["recommended_quantity"]
                for item in redistribution
            ),
            2,
        ),

        "total_procurement_quantity": round(
            sum(
                item["recommended_quantity"]
                for item in procurement
            ),
            2,
        ),

        "priority_counts": priority_counts,

        "recommendations": recommendations,
    }