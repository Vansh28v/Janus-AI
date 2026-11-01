"""
GRIDSTOCK AI
Dataset-Aware Supplier Intelligence Service

Analyzes supplier and purchase order data from the
currently active dataset.

Supports:
- Synthetic Demo datasets
- Uploaded datasets
- Optional supplier performance fields
- Delivery reliability analysis
- Procurement spend analysis
"""

import numpy as np
import pandas as pd

from app.core.dataset_manager import (
    get_dataset_file,
    get_active_dataset,
)


# ============================================================
# DATASET INFORMATION
# ============================================================

def get_dataset_information():
    """Return metadata for the currently active dataset."""

    dataset = get_active_dataset()

    if not dataset:
        raise ValueError("No active dataset is configured.")

    return {
        "dataset_id": (
            dataset.get("dataset_id")
            or dataset.get("id")
        ),
        "dataset_name": dataset.get("name"),
        "dataset_type": dataset.get("type"),
    }


def get_data_source():
    """Identify whether the active data is synthetic or uploaded."""

    dataset = get_active_dataset()

    if not dataset:
        raise ValueError("No active dataset is configured.")

    if dataset.get("type") == "synthetic":
        return "SYNTHETIC"

    return "UPLOADED"


# ============================================================
# BOOLEAN NORMALIZATION
# ============================================================

def normalize_boolean(series):

    """
    Normalize common CSV/Excel boolean representations.
    Unknown and missing values are treated as False for
    boolean event flags.
    """

    true_values = {
        "true",
        "1",
        "yes",
        "y",
        "on",
    }

    if pd.api.types.is_bool_dtype(series):
        return series.fillna(False).astype(bool)

    return (
        series.astype(str)
        .str.strip()
        .str.lower()
        .isin(true_values)
    )


# ============================================================
# DATA LOADING
# ============================================================

def load_supplier_data():
    """Load and normalize supplier master and purchase order data."""

    suppliers_path = get_dataset_file("suppliers.csv")
    orders_path = get_dataset_file("purchase_orders.csv")

    if not suppliers_path.exists():
        raise FileNotFoundError(
            "suppliers.csv not found in the active dataset."
        )

    if not orders_path.exists():
        raise FileNotFoundError(
            "purchase_orders.csv not found in the active dataset."
        )

    suppliers = pd.read_csv(suppliers_path)
    orders = pd.read_csv(orders_path)

    if suppliers.empty:
        raise ValueError("Supplier dataset is empty.")

    if orders.empty:
        raise ValueError("Purchase order dataset is empty.")

    # --------------------------------------------------------
    # REQUIRED SUPPLIER FIELDS
    # --------------------------------------------------------

    required_supplier_columns = {
        "supplier_code",
        "supplier_name",
    }

    missing_supplier_columns = (
        required_supplier_columns - set(suppliers.columns)
    )

    if missing_supplier_columns:
        raise ValueError(
            "suppliers.csv is missing required columns: "
            f"{sorted(missing_supplier_columns)}"
        )

    # --------------------------------------------------------
    # REQUIRED PURCHASE ORDER FIELDS
    # --------------------------------------------------------

    required_order_columns = {
        "supplier_code",
        "status",
    }

    missing_order_columns = (
        required_order_columns - set(orders.columns)
    )

    if missing_order_columns:
        raise ValueError(
            "purchase_orders.csv is missing required columns: "
            f"{sorted(missing_order_columns)}"
        )

    # --------------------------------------------------------
    # IDENTIFIER NORMALIZATION
    # --------------------------------------------------------

    suppliers["supplier_code"] = (
        suppliers["supplier_code"]
        .astype(str)
        .str.strip()
    )

    suppliers["supplier_name"] = (
        suppliers["supplier_name"]
        .astype(str)
        .str.strip()
    )

    orders["supplier_code"] = (
        orders["supplier_code"]
        .astype(str)
        .str.strip()
    )

    orders["status"] = (
        orders["status"]
        .astype(str)
        .str.strip()
        .str.upper()
    )

    if (
        suppliers["supplier_code"].eq("").any()
        or orders["supplier_code"].eq("").any()
    ):
        raise ValueError(
            "Supplier codes cannot be empty."
        )

    if suppliers["supplier_code"].duplicated().any():
        raise ValueError(
            "suppliers.csv contains duplicate supplier codes."
        )

    # --------------------------------------------------------
    # PURCHASE ORDER IDENTIFIERS
    # --------------------------------------------------------

    if "po_id" not in orders.columns:
        orders["po_id"] = [
            f"ORDER-{index + 1}"
            for index in range(len(orders))
        ]

    # --------------------------------------------------------
    # EMERGENCY ORDER FLAG
    # --------------------------------------------------------

    if "is_emergency" in orders.columns:

        orders["is_emergency"] = normalize_boolean(
            orders["is_emergency"]
        )

    else:
        orders["is_emergency"] = False

    # --------------------------------------------------------
    # DELIVERY DATE NORMALIZATION
    # --------------------------------------------------------

    for column in [
        "expected_arrival_date",
        "actual_arrival_date",
        "receipt_date",
    ]:

        if column in orders.columns:

            orders[column] = pd.to_datetime(
                orders[column],
                errors="coerce",
            )

    # --------------------------------------------------------
    # DELAY STATUS
    # --------------------------------------------------------

    if "is_delayed" in orders.columns:

        orders["is_delayed"] = normalize_boolean(
            orders["is_delayed"]
        )

    elif (
        "expected_arrival_date" in orders.columns
        and (
            "actual_arrival_date" in orders.columns
            or "receipt_date" in orders.columns
        )
    ):

        actual_date_column = (
            "actual_arrival_date"
            if "actual_arrival_date" in orders.columns
            else "receipt_date"
        )

        orders["is_delayed"] = (
            orders[actual_date_column]
            > orders["expected_arrival_date"]
        ).fillna(False)

    else:

        orders["is_delayed"] = False

    # --------------------------------------------------------
    # LEAD TIME NORMALIZATION
    # --------------------------------------------------------

    lead_time_columns = [
        "actual_lead_time_days",
        "expected_lead_time_days",
    ]

    for column in lead_time_columns:

        if column not in orders.columns:
            orders[column] = np.nan

        orders[column] = pd.to_numeric(
            orders[column],
            errors="coerce",
        )

        orders.loc[
            orders[column] < 0,
            column
        ] = np.nan

    # Derive actual lead time when dates are available.

    if "actual_arrival_date" in orders.columns:

        if "order_date" in orders.columns:

            orders["order_date"] = pd.to_datetime(
                orders["order_date"],
                errors="coerce",
            )

            derived_lead_time = (
                orders["actual_arrival_date"]
                - orders["order_date"]
            ).dt.days

            orders["actual_lead_time_days"] = (
                orders["actual_lead_time_days"]
                .fillna(derived_lead_time)
            )

    # --------------------------------------------------------
    # PROCUREMENT COST NORMALIZATION
    # --------------------------------------------------------

    if "total_cost" in orders.columns:

        orders["total_cost"] = pd.to_numeric(
            orders["total_cost"],
            errors="coerce",
        )

    elif (
        "ordered_quantity" in orders.columns
        and "unit_cost" in orders.columns
    ):

        orders["ordered_quantity"] = pd.to_numeric(
            orders["ordered_quantity"],
            errors="coerce",
        )

        orders["unit_cost"] = pd.to_numeric(
            orders["unit_cost"],
            errors="coerce",
        )

        orders["total_cost"] = (
            orders["ordered_quantity"]
            * orders["unit_cost"]
        )

    else:

        # Do not invent procurement spend when cost information
        # is unavailable.

        orders["total_cost"] = np.nan

    return suppliers, orders


# ============================================================
# SUPPLIER INTELLIGENCE ENGINE
# ============================================================

def generate_supplier_intelligence():
    """Generate supplier performance and procurement analytics."""

    suppliers, orders = load_supplier_data()

    data_source = get_data_source()

    dataset_information = get_dataset_information()

    # --------------------------------------------------------
    # ORDER STATUS
    # --------------------------------------------------------

    received = orders[
        orders["status"] == "RECEIVED"
    ].copy()

    outstanding = orders[
        orders["status"] == "OUTSTANDING"
    ].copy()

    # --------------------------------------------------------
    # SUPPLIER ORDER SUMMARY
    # --------------------------------------------------------

    order_summary = orders.groupby(
        "supplier_code"
    ).agg(
        total_orders=("po_id", "count"),

        outstanding_orders=(
            "status",
            lambda x: (x == "OUTSTANDING").sum()
        ),

        emergency_orders=("is_emergency", "sum"),

        total_spend=(
            "total_cost",
            lambda x: x.sum(min_count=1)
        ),

    ).reset_index()

    # --------------------------------------------------------
    # DELIVERY PERFORMANCE
    # --------------------------------------------------------

    delivery_summary = received.groupby(
        "supplier_code"
    ).agg(
        received_orders=("po_id", "count"),

        delayed_received_orders=("is_delayed", "sum"),

        average_actual_lead_time=(
            "actual_lead_time_days",
            "mean"
        ),

        average_expected_lead_time=(
            "expected_lead_time_days",
            "mean"
        ),

    ).reset_index()

    # --------------------------------------------------------
    # MERGE SUPPLIER INFORMATION
    # --------------------------------------------------------

    performance = suppliers.merge(
        order_summary,
        on="supplier_code",
        how="left",
    )

    performance = performance.merge(
        delivery_summary,
        on="supplier_code",
        how="left",
    )

    # --------------------------------------------------------
    # MISSING VALUE HANDLING
    # --------------------------------------------------------

    count_columns = [
        "total_orders",
        "outstanding_orders",
        "emergency_orders",
        "received_orders",
        "delayed_received_orders",
    ]

    for column in count_columns:

        performance[column] = (
            performance[column].fillna(0)
        ).astype(int)

    performance["total_spend"] = pd.to_numeric(
        performance["total_spend"],
        errors="coerce",
    )

    performance["average_actual_lead_time"] = (
        pd.to_numeric(
            performance["average_actual_lead_time"],
            errors="coerce",
        )
    )

    performance["average_expected_lead_time"] = (
        pd.to_numeric(
            performance["average_expected_lead_time"],
            errors="coerce",
        )
    )

    # --------------------------------------------------------
    # DELIVERY RELIABILITY
    # --------------------------------------------------------

    performance["on_time_orders"] = (
        performance["received_orders"]
        - performance["delayed_received_orders"]
    )

    performance["on_time_rate_pct"] = (
        performance["on_time_orders"]
        / performance["received_orders"].replace(
            0,
            np.nan,
        )
        * 100
    )

    performance["delay_rate_pct"] = (
        performance["delayed_received_orders"]
        / performance["received_orders"].replace(
            0,
            np.nan,
        )
        * 100
    )

    performance["lead_time_variance_days"] = (
        performance["average_actual_lead_time"]
        - performance["average_expected_lead_time"]
    )

    performance["on_time_rate_pct"] = (
        performance["on_time_rate_pct"].round(2)
    )

    performance["delay_rate_pct"] = (
        performance["delay_rate_pct"].round(2)
    )

    performance["lead_time_variance_days"] = (
        performance["lead_time_variance_days"].round(2)
    )

    performance["average_actual_lead_time"] = (
        performance["average_actual_lead_time"].round(2)
    )

    performance["average_expected_lead_time"] = (
        performance["average_expected_lead_time"].round(2)
    )

    performance["total_spend"] = (
        performance["total_spend"].round(2)
    )

    # Suppliers without received orders are placed last.
    performance = performance.sort_values(
        by="on_time_rate_pct",
        ascending=False,
        na_position="last",
    )

    # --------------------------------------------------------
    # PROCUREMENT SUMMARY
    # --------------------------------------------------------

    total_orders = len(orders)

    received_orders = len(received)

    outstanding_orders = len(outstanding)

    delayed_received = int(
        received["is_delayed"].sum()
    )

    on_time_received = (
        received_orders - delayed_received
    )

    spend_available = orders["total_cost"].notna().any()

    total_spend = (
        float(orders["total_cost"].sum())
        if spend_available
        else None
    )

    overall_on_time_rate = (
        on_time_received / received_orders * 100
        if received_orders
        else None
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "source": data_source,

        "dataset": dataset_information,

        "summary": {
            "total_suppliers": int(len(suppliers)),

            "total_orders": int(total_orders),

            "received_orders": int(received_orders),

            "outstanding_orders": int(outstanding_orders),

            "delayed_received_orders": int(delayed_received),

            "on_time_received_orders": int(on_time_received),

            "emergency_orders": int(
                orders["is_emergency"].sum()
            ),

            "total_procurement_spend": (
                round(total_spend, 2)
                if total_spend is not None
                else None
            ),

            "overall_on_time_rate_pct": (
                round(overall_on_time_rate, 2)
                if overall_on_time_rate is not None
                else None
            ),

            "spend_data_available": bool(spend_available),
        },

        "suppliers": performance.replace(
            [np.inf, -np.inf],
            np.nan,
        ).astype(object).where(
            pd.notna(performance),
            None,
        ).to_dict(
            orient="records"
        ),
    }