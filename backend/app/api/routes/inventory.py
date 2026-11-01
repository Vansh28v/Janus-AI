"""
GRIDSTOCK AI
Dataset-Aware Inventory Intelligence API

Serves inventory, procurement, stock movement
and material master data from the active dataset.
"""

import json

import pandas as pd

from fastapi import APIRouter, HTTPException, Query

from app.core.dataset_manager import (
    get_dataset_file,
    get_active_dataset,
)


router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory Intelligence"],
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
# CSV LOADER
# ------------------------------------------------------------

def load_csv(filename: str) -> pd.DataFrame:
    """Load a CSV from the currently active dataset."""

    try:
        filepath = get_dataset_file(filename)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if not filepath.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Dataset file not available: {filename}. "
                "The active dataset may not contain this data."
            ),
        )

    try:
        return pd.read_csv(filepath)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read {filename}: {str(error)}",
        )


# ------------------------------------------------------------
# JSON-SAFE RECORD CONVERSION
# ------------------------------------------------------------

def to_records(df: pd.DataFrame) -> list:

    if df.empty:
        return []

    return json.loads(
        df.to_json(
            orient="records",
            date_format="iso"
        )
    )


# ------------------------------------------------------------
# LATEST INVENTORY SNAPSHOT
# ------------------------------------------------------------

def get_latest_inventory() -> tuple[pd.DataFrame, str]:

    df = load_csv("weekly_inventory.csv")

    if df.empty:
        return df, ""

    if "week_start" not in df.columns:
        raise HTTPException(
            status_code=500,
            detail="weekly_inventory.csv is missing week_start.",
        )

    df["week_start"] = df["week_start"].astype(str)

    latest_week = df["week_start"].max()

    latest = df[
        df["week_start"] == latest_week
    ].copy()

    return latest, latest_week


# ------------------------------------------------------------
# COMMON FILTERS
# ------------------------------------------------------------

def apply_stock_filters(
    df: pd.DataFrame,
    item_code: str | None,
    location_code: str | None,
) -> pd.DataFrame:

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    return df


# ------------------------------------------------------------
# 1. INVENTORY OVERVIEW
# ------------------------------------------------------------

@router.get("/overview")
def inventory_overview():

    latest, latest_week = get_latest_inventory()

    purchase_orders = load_csv("purchase_orders.csv")

    historical = load_csv("weekly_inventory.csv")

    if latest.empty:
        raise HTTPException(
            status_code=503,
            detail="Inventory dataset is empty.",
        )

    required_columns = {
        "item_code",
        "location_code",
        "closing_stock",
        "reorder_point",
        "unmet_quantity",
    }

    missing = required_columns - set(latest.columns)

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Inventory data is missing columns: {sorted(missing)}",
        )

    if purchase_orders.empty:
        po_status = pd.Series(dtype=str)
    else:
        po_status = (
            purchase_orders["status"]
            .astype(str)
            .str.upper()
        )

    delayed_count = (
        purchase_orders["is_delayed"].astype(bool).sum()
        if "is_delayed" in purchase_orders.columns
        else 0
    )

    emergency_count = (
        purchase_orders["is_emergency"].astype(bool).sum()
        if "is_emergency" in purchase_orders.columns
        else 0
    )

    source = get_data_source()

    return {
        "latest_week": latest_week,

        "total_materials": int(
            latest["item_code"].nunique()
        ),

        "total_locations": int(
            latest["location_code"].nunique()
        ),

        "tracked_combinations": int(len(latest)),

        "low_stock_combinations": int(
            (
                latest["closing_stock"]
                <= latest["reorder_point"]
            ).sum()
        ),

        "latest_unmet_demand_combinations": int(
            (latest["unmet_quantity"] > 0).sum()
        ),

        "historical_stockout_weeks": int(
            (
                historical["unmet_quantity"] > 0
            ).sum()
        ),

        "purchase_orders_total": int(
            len(purchase_orders)
        ),

        "purchase_orders_received": int(
            (po_status == "RECEIVED").sum()
        ),

        "purchase_orders_outstanding": int(
            (po_status == "OUTSTANDING").sum()
        ),

        "purchase_orders_delayed": int(
            delayed_count
        ),

        "purchase_orders_emergency": int(
            emergency_count
        ),

        "source": source,

        "dataset": get_dataset_information(),
    }


# ------------------------------------------------------------
# 2. CURRENT STOCK
# ------------------------------------------------------------

@router.get("/stock")
def get_stock(
    item_code: str | None = None,
    location_code: str | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000
    ),
):

    latest, latest_week = get_latest_inventory()

    latest = apply_stock_filters(
        latest,
        item_code,
        location_code,
    )

    latest = latest.sort_values(
        by=["item_code", "location_code"]
    )

    return {
        "latest_week": latest_week,

        "total_records": int(len(latest)),

        "returned_records": int(
            min(len(latest), limit)
        ),

        "records": to_records(
            latest.head(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }


# ------------------------------------------------------------
# 3. MATERIAL INTELLIGENCE MASTER
# ------------------------------------------------------------

@router.get("/materials")
def get_material_intelligence(
    item_code: str | None = None,
    category: str | None = None,
    criticality: str | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000
    ),
):
    """
    Join material master data with the latest inventory snapshot.

    One record is returned per material. Inventory quantities
    are aggregated across locations; stock cover is averaged.
    """

    materials = load_csv("materials.csv")

    latest, latest_week = get_latest_inventory()

    if materials.empty:
        raise HTTPException(
            status_code=503,
            detail="Material master dataset is empty.",
        )

    if latest.empty:
        raise HTTPException(
            status_code=503,
            detail="Inventory dataset is empty.",
        )

    required_columns = [
        "item_code",
        "item_name",
        "category",
        "unit",
        "criticality",
        "unit_cost",
        "lead_time_days",
    ]

    missing = [
        column
        for column in required_columns
        if column not in materials.columns
    ]

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing columns in materials.csv: {missing}",
        )

    materials["item_code"] = (
        materials["item_code"].astype(str)
    )

    latest["item_code"] = (
        latest["item_code"].astype(str)
    )

    # Aggregate latest inventory across locations.

    aggregation = {
        "closing_stock": "sum",
        "inventory_position": "sum",
        "reorder_point": "sum",
        "target_stock": "sum",
        "projected_shortage_before_delivery": "sum",
        "stock_cover_days": "mean",
        "location_code": "nunique",
    }

    available_aggregation = {
        key: value
        for key, value in aggregation.items()
        if key in latest.columns
    }

    stock_summary = (
        latest.groupby(
            "item_code",
            as_index=False
        )
        .agg(available_aggregation)
        .rename(
            columns={
                "location_code": "locations",
                "projected_shortage_before_delivery": "projected_shortage",
            }
        )
    )

    # Join master data to aggregated inventory.

    merged = materials.merge(
        stock_summary,
        on="item_code",
        how="left",
    )

    # Preserve materials even if a stock record is missing.

    numeric_columns = [
        "closing_stock",
        "inventory_position",
        "reorder_point",
        "target_stock",
        "projected_shortage",
        "stock_cover_days",
        "locations",
    ]

    for column in numeric_columns:

        if column not in merged.columns:
            merged[column] = 0

        merged[column] = merged[column].fillna(0)

    # Apply optional filters.

    if item_code:
        merged = merged[
            merged["item_code"] == item_code
        ]

    if category:
        merged = merged[
            merged["category"].astype(str).str.casefold()
            == category.casefold()
        ]

    if criticality:
        merged = merged[
            merged["criticality"].astype(str).str.casefold()
            == criticality.casefold()
        ]

    merged = merged.sort_values(
        by="item_code"
    )

    total_records = len(merged)

    return {
        "latest_week": latest_week,

        "total_records": int(total_records),

        "returned_records": int(
            min(total_records, limit)
        ),

        "records": to_records(
            merged.head(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }
# ------------------------------------------------------------
# 4. INVENTORY ALERTS
# ------------------------------------------------------------

@router.get("/alerts")
def get_inventory_alerts(
    item_code: str | None = None,
    location_code: str | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000
    ),
):

    latest, latest_week = get_latest_inventory()

    latest = apply_stock_filters(
        latest,
        item_code,
        location_code,
    )

    alerts = []

    for _, row in latest.iterrows():

        alert_types = []

        if row["closing_stock"] <= row["reorder_point"]:
            alert_types.append("LOW_STOCK")

        if row["unmet_quantity"] > 0:
            alert_types.append("UNMET_DEMAND")

        if not alert_types:
            continue

        record = row.to_dict()

        record["alert_types"] = alert_types

        alerts.append(record)

    alerts.sort(
        key=lambda record: (
            record["unmet_quantity"],
            record["reorder_point"] - record["closing_stock"],
        ),
        reverse=True,
    )

    return {
        "latest_week": latest_week,

        "total_alerts": len(alerts),

        "returned_records": min(
            len(alerts),
            limit
        ),

        "records": to_records(
            pd.DataFrame(alerts).head(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }


# ------------------------------------------------------------
# 5. PURCHASE ORDERS
# ------------------------------------------------------------

@router.get("/purchase-orders")
def get_purchase_orders(
    item_code: str | None = None,
    location_code: str | None = None,
    status: str | None = None,
    emergency: bool | None = None,
    delayed: bool | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000
    ),
):

    df = load_csv("purchase_orders.csv")

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    if status:
        df = df[
            df["status"].astype(str).str.upper()
            == status.upper()
        ]

    if emergency is not None:

        if "is_emergency" not in df.columns:
            df = df.iloc[0:0]

        else:
            df = df[
                df["is_emergency"].astype(str).str.lower()
                == str(emergency).lower()
            ]

    if delayed is not None:

        if "is_delayed" not in df.columns:
            df = df.iloc[0:0]

        else:
            df = df[
                df["is_delayed"].astype(str).str.lower()
                == str(delayed).lower()
            ]

    if "order_date" in df.columns:
        df = df.sort_values(
            by="order_date",
            ascending=False,
        )

    total_records = len(df)

    return {
        "total_records": int(total_records),

        "returned_records": int(
            min(total_records, limit)
        ),

        "records": to_records(
            df.head(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }


# ------------------------------------------------------------
# 6. STOCK MOVEMENTS
# ------------------------------------------------------------

@router.get("/movements")
def get_stock_movements(
    item_code: str | None = None,
    location_code: str | None = None,
    movement_type: str | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000
    ),
):

    df = load_csv("stock_movements.csv")

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    if movement_type:
        df = df[
            df["movement_type"].astype(str).str.upper()
            == movement_type.upper()
        ]

    if "movement_date" in df.columns:
        df = df.sort_values(
            by="movement_date",
            ascending=False,
        )

    total_records = len(df)

    return {
        "total_records": int(total_records),

        "returned_records": int(
            min(total_records, limit)
        ),

        "records": to_records(
            df.head(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }
# ------------------------------------------------------------
# 7. WEEKLY INVENTORY HISTORY
# ------------------------------------------------------------

@router.get("/weekly")
def get_weekly_inventory(
    item_code: str | None = None,
    location_code: str | None = None,
    limit: int = Query(
        default=1000,
        ge=1,
        le=20000
    ),
):

    df = load_csv("weekly_inventory.csv")

    df = apply_stock_filters(
        df,
        item_code,
        location_code,
    )

    if "week_start" in df.columns:
        df = df.sort_values(
            by="week_start",
            ascending=True,
        )

    total_records = len(df)

    return {
        "total_records": int(total_records),

        "returned_records": int(
            min(total_records, limit)
        ),

        "records": to_records(
            df.tail(limit)
        ),

        "source": get_data_source(),

        "dataset": get_dataset_information(),
    }