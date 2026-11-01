"""
GRIDSTOCK AI
Dataset Quality & Workspace Compatibility Engine

Responsibilities:
- Inspect normalized uploaded tables.
- Check required columns and empty datasets.
- Detect missing values, duplicate rows and invalid numeric values.
- Check material, location and supplier relationships.
- Determine individual workspace compatibility.
- Calculate a transparent quality score.
- Decide whether a dataset is eligible for approval.

This service never modifies source or normalized CSV files.
"""

from pathlib import Path
from datetime import datetime, timezone
from typing import Any

from app.core.dataset_manager import (
    UPLOADS_DIR,
    get_dataset,
    update_dataset,
    get_active_dataset,
)

import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

TABLE_SCHEMAS = {
    "materials": {
        "required": [
            "item_code",
            "item_name",
            "unit",
        ],
        "optional": [
            "category",
            "criticality",
            "unit_cost",
            "lead_time_days",
        ],
    },
    "locations": {
        "required": [
            "location_code",
            "location_name",
        ],
        "optional": [
            "region",
            "latitude",
            "longitude",
        ],
    },
    "suppliers": {
        "required": [
            "supplier_code",
            "supplier_name",
        ],
        "optional": [
            "supplier_type",
            "contact",
            "lead_time_days",
        ],
    },
        "consumption": {
        "required": [
            "week_start",
            "item_code",
            "location_code",
            "quantity_consumed",
        ],
        "optional": [
            "demand_type",
            "source",
            "is_spike",
            "unit",
        ],
    },
        "opening_balances": {
        "required": [
            "item_code",
            "location_code",
            "opening_quantity",
        ],
        "optional": [
            "as_of_date",
            "week_start",
            "source",
            "unit",
        ],
    },
    "stock_movements": {
        "required": [
            "item_code",
            "location_code",
            "quantity",
        ],
        "optional": [
            "movement_date",
            "movement_type",
            "reference",
        ],
    },
    "purchase_orders": {
        "required": [
            "po_id",
            "item_code",
            "location_code",
            "ordered_quantity",
        ],
        "optional": [
            "supplier_code",
            "order_date",
            "expected_arrival_date",
            "actual_arrival_date",
            "status",
            "unit_cost",
            "total_cost",
        ],
    },
    "weekly_inventory": {
        "required": [
            "week_start",
            "item_code",
            "location_code",
            "closing_stock",
        ],
        "optional": [
            "opening_stock",
            "requested_quantity",
            "issued_quantity",
            "unmet_quantity",
            "inventory_position",
            "reorder_point",
            "target_stock",
        ],
    },
}


# Each workspace is assessed independently.
# A missing optional workspace must not block other workspaces.


WORKSPACE_REQUIREMENTS = {
    "forecasting": {
        "tables": {
            "consumption": [
                "week_start",
                "item_code",
                "location_code",
                "quantity_consumed",
            ],
        },
    },

    "inventory": {
        "tables": {
            "weekly_inventory": [
                "week_start",
                "item_code",
                "location_code",
                "closing_stock",
                "unit",
            ],
            "materials": [
                "item_code",
                "item_name",
            ],
            "locations": [
                "location_code",
            ],
        },
    },

    "optimization": {
        "tables": {
            "weekly_inventory": [
                "week_start",
                "item_code",
                "location_code",
                "closing_stock",
                "reorder_point",
                "target_stock",
            ],
            "materials": [
                "item_code",
                "unit_cost",
            ],
        },
    },

    "suppliers": {
        "tables": {
            "suppliers": [
                "supplier_code",
                "supplier_name",
            ],
            "purchase_orders": [
                "po_id",
                "item_code",
                "supplier_code",
                "ordered_quantity",
            ],
        },
    },

    "scenarios": {
        "tables": {
            "weekly_inventory": [
                "week_start",
                "item_code",
                "location_code",
                "closing_stock",
                "reorder_point",
                "target_stock",
                "unit",
            ],
            "purchase_orders": [
                "po_id",
                "expected_arrival_date",
                "item_code",
                "location_code",
                "supplier_code",
                "ordered_quantity",
                "status",
            ],
            "materials": [
                "item_code",
                "item_name",
                "unit",
                "unit_cost",
                "lead_time_days",
                "criticality",
            ],
            "locations": [
                "location_code",
            ],
            "suppliers": [
                "supplier_code",
                "supplier_name",
            ],
        },
    },
}



NUMERIC_COLUMNS = {
    "quantity",
    "opening_stock",
    "closing_stock",
    "issued_quantity",
    "requested_quantity",
    "unmet_quantity",
    "inventory_position",
    "reorder_point",
    "target_stock",
    "ordered_quantity",
    "unit_cost",
    "total_cost",
    "lead_time_days",
    "quantity_consumed",
    "opening_quantity",
}


NON_NEGATIVE_COLUMNS = {
    "quantity",
    "opening_stock",
    "closing_stock",
    "issued_quantity",
    "requested_quantity",
    "unmet_quantity",
    "inventory_position",
    "reorder_point",
    "target_stock",
    "ordered_quantity",
    "unit_cost",
    "total_cost",
    "lead_time_days",
        "quantity_consumed",
    "opening_quantity",
}


# ============================================================
# CSV LOADING
# ============================================================

def load_normalized_tables(
    normalized_dir: Path,
) -> tuple[dict[str, pd.DataFrame], list[dict]]:
    """
    Load only recognized canonical CSV files.

    Returns:
        tables: canonical table name -> DataFrame
        issues: file loading problems
    """

    tables = {}
    issues = []

    if not normalized_dir.exists():
        return tables, [
            {
                "code": "NORMALIZED_DIRECTORY_MISSING",
                "severity": "error",
                "table": None,
                "message": (
                    "The normalized dataset directory does not exist."
                ),
                "count": 1,
            }
        ]

    for table_name in TABLE_SCHEMAS:
        filepath = normalized_dir / f"{table_name}.csv"

        if not filepath.exists():
            continue

        try:
            df = pd.read_csv(
                filepath,
                low_memory=False,
            )

            df.columns = [
                str(column).strip()
                for column in df.columns
            ]

            tables[table_name] = df

        except Exception as error:
            issues.append({
                "code": "TABLE_READ_ERROR",
                "severity": "error",
                "table": table_name,
                "message": (
                    f"Could not read {table_name}.csv: {str(error)}"
                ),
                "count": 1,
            })

    return tables, issues


# ============================================================
# ISSUE HELPER
# ============================================================

def add_issue(
    issues: list[dict],
    code: str,
    severity: str,
    message: str,
    table: str | None = None,
    count: int | None = None,
):
    issues.append({
        "code": code,
        "severity": severity,
        "message": message,
        "table": table,
        "count": count,
    })


# ============================================================
# STRUCTURAL TABLE CHECKS
# ============================================================

def inspect_table(
    table_name: str,
    df: pd.DataFrame,
    issues: list[dict],
) -> dict:

    schema = TABLE_SCHEMAS[table_name]

    required_columns = set(schema["required"])
    available_columns = set(df.columns)

    missing_columns = sorted(
        required_columns - available_columns
    )

    if missing_columns:
        add_issue(
            issues,
            "REQUIRED_COLUMNS_MISSING",
            "error",
            (
                f"{table_name} is missing required columns: "
                f"{', '.join(missing_columns)}"
            ),
            table_name,
            len(missing_columns),
        )

    if df.empty:
        add_issue(
            issues,
            "EMPTY_TABLE",
            "error",
            f"{table_name}.csv contains no records.",
            table_name,
            0,
        )

    duplicate_rows = int(
        df.duplicated().sum()
    )

    if duplicate_rows:
        add_issue(
            issues,
            "DUPLICATE_ROWS",
            "warning",
            (
                f"{table_name} contains "
                f"{duplicate_rows} duplicate row(s)."
            ),
            table_name,
            duplicate_rows,
        )

    missing_cells = int(
        df.isna().sum().sum()
    )

    total_cells = int(
        df.shape[0] * df.shape[1]
    )

    missing_percentage = (
        round(missing_cells / total_cells * 100, 2)
        if total_cells
        else 0.0
    )

    if missing_cells:
        add_issue(
            issues,
            "MISSING_VALUES",
            "warning",
            (
                f"{table_name} contains {missing_cells} "
                f"missing value(s) "
                f"({missing_percentage}%)."
            ),
            table_name,
            missing_cells,
        )

    return {
        "table": table_name,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "required_columns": schema["required"],
        "missing_columns": missing_columns,
        "duplicate_rows": duplicate_rows,
        "missing_cells": missing_cells,
        "missing_percentage": missing_percentage,
        "valid_structure": not missing_columns and not df.empty,
    }
# ============================================================
# NUMERIC VALIDATION
# ============================================================

def inspect_numeric_values(
    table_name: str,
    df: pd.DataFrame,
    issues: list[dict],
) -> dict:

    checked_columns = []
    invalid_values = 0
    negative_values = 0

    for column in NUMERIC_COLUMNS:
        if column not in df.columns:
            continue

        checked_columns.append(column)

        original = df[column]
        converted = pd.to_numeric(
            original,
            errors="coerce",
        )

        invalid_mask = original.notna() & converted.isna()
        invalid_count = int(invalid_mask.sum())

        if invalid_count:
            invalid_values += invalid_count

            add_issue(
                issues,
                "INVALID_NUMERIC_VALUES",
                "error",
                f"{table_name}.{column} contains {invalid_count} non-numeric value(s).",
                table_name,
                invalid_count,
            )

        if column in NON_NEGATIVE_COLUMNS:
            negative_count = int((converted < 0).sum())

            if negative_count:
                negative_values += negative_count

                add_issue(
                    issues,
                    "NEGATIVE_QUANTITIES",
                    "warning",
                    f"{table_name}.{column} contains {negative_count} negative value(s). Review whether these represent valid returns or adjustments.",
                    table_name,
                    negative_count,
                )

    return {
        "checked_columns": checked_columns,
        "invalid_values": invalid_values,
        "negative_values": negative_values,
    }


# ============================================================
# DATE VALIDATION
# ============================================================

DATE_COLUMNS = {
    "consumption": ["week_start"],
    "opening_balances": ["as_of_date", "week_start"],
    "stock_movements": ["movement_date"],
    "purchase_orders": [
        "order_date",
        "expected_arrival_date",
        "actual_arrival_date",
    ],
    "weekly_inventory": ["week_start"],
}


def inspect_date_values(
    table_name: str,
    df: pd.DataFrame,
    issues: list[dict],
) -> dict:

    checked_columns = []
    invalid_dates = 0

    for column in DATE_COLUMNS.get(table_name, []):
        if column not in df.columns:
            continue

        checked_columns.append(column)
        original = df[column]

        parsed = pd.to_datetime(
            original,
            errors="coerce",
        )

        invalid_mask = original.notna() & parsed.isna()
        invalid_count = int(invalid_mask.sum())

        if invalid_count:
            invalid_dates += invalid_count

            add_issue(
                issues,
                "INVALID_DATE_VALUES",
                "error",
                f"{table_name}.{column} contains {invalid_count} invalid date value(s).",
                table_name,
                invalid_count,
            )

    if table_name == "purchase_orders":

        if (
            "order_date" in df.columns
            and "expected_arrival_date" in df.columns
        ):
            order_dates = pd.to_datetime(
                df["order_date"],
                errors="coerce",
            )

            expected_dates = pd.to_datetime(
                df["expected_arrival_date"],
                errors="coerce",
            )

            invalid_order = (
                order_dates.notna()
                & expected_dates.notna()
                & (expected_dates < order_dates)
            )

            count = int(invalid_order.sum())

            if count:
                add_issue(
                    issues,
                    "INVALID_PO_DATE_SEQUENCE",
                    "warning",
                    f"{count} purchase order(s) have an expected arrival date before their order date.",
                    table_name,
                    count,
                )

        if (
            "order_date" in df.columns
            and "actual_arrival_date" in df.columns
        ):
            order_dates = pd.to_datetime(
                df["order_date"],
                errors="coerce",
            )

            actual_dates = pd.to_datetime(
                df["actual_arrival_date"],
                errors="coerce",
            )

            invalid_actual = (
                order_dates.notna()
                & actual_dates.notna()
                & (actual_dates < order_dates)
            )

            count = int(invalid_actual.sum())

            if count:
                add_issue(
                    issues,
                    "INVALID_ACTUAL_ARRIVAL_SEQUENCE",
                    "warning",
                    f"{count} purchase order(s) have an actual arrival date before their order date.",
                    table_name,
                    count,
                )

    return {
        "checked_columns": checked_columns,
        "invalid_dates": invalid_dates,
    }


# ============================================================
# BUSINESS KEY DUPLICATE CHECKS
# ============================================================

BUSINESS_KEYS = {
    "materials": ["item_code"],
    "locations": ["location_code"],
    "suppliers": ["supplier_code"],
    "purchase_orders": ["po_id"],
    "weekly_inventory": [
        "week_start",
        "item_code",
        "location_code",
    ],
    "consumption": [
        "week_start",
        "item_code",
        "location_code",
    ],
}


def inspect_business_keys(
    table_name: str,
    df: pd.DataFrame,
    issues: list[dict],
) -> dict:

    keys = BUSINESS_KEYS.get(table_name, [])

    if not keys:
        return {
            "key_columns": [],
            "duplicate_keys": 0,
        }

    missing_columns = [
        column for column in keys
        if column not in df.columns
    ]

    if missing_columns:
        return {
            "key_columns": keys,
            "duplicate_keys": 0,
        }

    key_frame = df[keys]
    missing_mask = key_frame.isna().any(axis=1)
    missing_count = int(missing_mask.sum())

    if missing_count:
        add_issue(
            issues,
            "MISSING_BUSINESS_KEYS",
            "error",
            f"{table_name} contains {missing_count} row(s) with missing business key values.",
            table_name,
            missing_count,
        )

    valid_keys = key_frame[~missing_mask]

    duplicate_mask = valid_keys.duplicated(keep=False)
    duplicate_count = int(duplicate_mask.sum())

    if duplicate_count:
        add_issue(
            issues,
            "DUPLICATE_BUSINESS_KEYS",
            "error",
            f"{table_name} contains {duplicate_count} row(s) with duplicate business keys: {', '.join(keys)}.",
            table_name,
            duplicate_count,
        )

    return {
        "key_columns": keys,
        "duplicate_keys": duplicate_count,
        "missing_keys": missing_count,
    }


# ============================================================
# CROSS-TABLE RELATIONSHIP VALIDATION
# ============================================================

def inspect_relationship(
    child_table: str,
    child_df: pd.DataFrame,
    child_column: str,
    parent_table: str,
    parent_df: pd.DataFrame,
    parent_column: str,
    issues: list[dict],
) -> dict:

    if (
        child_column not in child_df.columns
        or parent_column not in parent_df.columns
    ):
        return {
            "relationship": (
                f"{child_table}.{child_column} -> "
                f"{parent_table}.{parent_column}"
            ),
            "checked": False,
            "unmatched_values": 0,
            "reason": "Required relationship column is unavailable.",
        }

    parent_values = set(
        parent_df[parent_column]
        .dropna()
        .astype(str)
        .str.strip()
    )

    child_values = (
        child_df[child_column]
        .dropna()
        .astype(str)
        .str.strip()
    )

    unmatched_count = int(
        (~child_values.isin(parent_values)).sum()
    )

    relationship_name = (
        f"{child_table}.{child_column} -> "
        f"{parent_table}.{parent_column}"
    )

    if unmatched_count:
        add_issue(
            issues,
            "UNMATCHED_REFERENCE",
            "error",
            f"{relationship_name} has {unmatched_count} value(s) that do not exist in the referenced master table.",
            child_table,
            unmatched_count,
        )

    return {
        "relationship": relationship_name,
        "checked": True,
        "unmatched_values": unmatched_count,
    }


def inspect_cross_table_relationships(
    tables: dict[str, pd.DataFrame],
    issues: list[dict],
) -> list[dict]:

    relationships = []

    definitions = [
        ("consumption", "item_code", "materials", "item_code"),
        ("consumption", "location_code", "locations", "location_code"),
        ("weekly_inventory", "item_code", "materials", "item_code"),
        ("weekly_inventory", "location_code", "locations", "location_code"),
        ("opening_balances", "item_code", "materials", "item_code"),
        ("opening_balances", "location_code", "locations", "location_code"),
        ("stock_movements", "item_code", "materials", "item_code"),
        ("stock_movements", "location_code", "locations", "location_code"),
        ("purchase_orders", "item_code", "materials", "item_code"),
        ("purchase_orders", "location_code", "locations", "location_code"),
        ("purchase_orders", "supplier_code", "suppliers", "supplier_code"),
    ]

    for child_table, child_column, parent_table, parent_column in definitions:

        if child_table not in tables or parent_table not in tables:
            continue

        result = inspect_relationship(
            child_table=child_table,
            child_df=tables[child_table],
            child_column=child_column,
            parent_table=parent_table,
            parent_df=tables[parent_table],
            parent_column=parent_column,
            issues=issues,
        )

        relationships.append(result)

    return relationships


# ============================================================
# TABLE-LEVEL DATA INSPECTION
# ============================================================

def inspect_data_integrity(
    tables: dict[str, pd.DataFrame],
    issues: list[dict],
) -> dict:

    table_reports = {}

    for table_name, df in tables.items():

        structure = inspect_table(
            table_name,
            df,
            issues,
        )

        numeric = inspect_numeric_values(
            table_name,
            df,
            issues,
        )

        dates = inspect_date_values(
            table_name,
            df,
            issues,
        )

        business_keys = inspect_business_keys(
            table_name,
            df,
            issues,
        )

        table_reports[table_name] = {
            **structure,
            "numeric_checks": numeric,
            "date_checks": dates,
            "business_key_checks": business_keys,
        }

    relationships = inspect_cross_table_relationships(
        tables,
        issues,
    )

    return {
        "tables": table_reports,
        "relationships": relationships,
    }
# ============================================================
# WORKSPACE COMPATIBILITY
# ============================================================

def assess_workspace_compatibility(
    tables: dict[str, pd.DataFrame],
    issues: list[dict],
) -> dict:

    results = {}

    for workspace, config in WORKSPACE_REQUIREMENTS.items():

        missing_tables = []
        missing_columns = []
        empty_tables = []
        blocking_issues = []

        required_table_names = list(config["tables"].keys())

        for table_name, required_columns in config["tables"].items():

            if table_name not in tables:
                missing_tables.append(table_name)
                continue

            df = tables[table_name]

            if df.empty:
                empty_tables.append(table_name)

            absent_columns = [
                column
                for column in required_columns
                if column not in df.columns
            ]

            if absent_columns:
                missing_columns.append({
                    "table": table_name,
                    "columns": absent_columns,
                })

        # Only errors affecting tables required by this workspace
        # prevent that particular workspace from becoming ready.
        for issue in issues:

            if issue.get("severity") != "error":
                continue

            issue_table = issue.get("table")

            if (
                issue_table in required_table_names
                or issue_table is None
            ):
                blocking_issues.append({
                    "code": issue.get("code"),
                    "table": issue_table,
                    "message": issue.get("message"),
                })

        compatible = (
            not missing_tables
            and not missing_columns
            and not empty_tables
            and not blocking_issues
        )

        results[workspace] = {
            "compatible": compatible,
            "status": "READY" if compatible else "UNAVAILABLE",
            "missing_tables": missing_tables,
            "missing_columns": missing_columns,
            "empty_tables": empty_tables,
            "blocking_issues": blocking_issues,
            "required_tables": required_table_names,
        }

    return results


# ============================================================
# QUALITY SCORE
# ============================================================

def calculate_quality_score(
    issues: list[dict],
) -> dict:

    error_count = sum(
        1 for issue in issues
        if issue.get("severity") == "error"
    )

    warning_count = sum(
        1 for issue in issues
        if issue.get("severity") == "warning"
    )

    # Transparent scoring:
    # Each error deducts 12 points, capped at 60.
    # Each warning deducts 3 points, capped at 30.
    error_deduction = min(error_count * 12, 60)
    warning_deduction = min(warning_count * 3, 30)

    score = max(
        0,
        min(100, 100 - error_deduction - warning_deduction),
    )

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": score,
        "grade": grade,
        "error_count": error_count,
        "warning_count": warning_count,
        "error_deduction": error_deduction,
        "warning_deduction": warning_deduction,
        "scoring_method": (
            "Starts at 100. Each error deducts 12 points "
            "(maximum 60 points). Each warning deducts "
            "3 points (maximum 30 points)."
        ),
    }


# ============================================================
# DATASET QUALITY ASSESSMENT
# ============================================================

def assess_dataset_quality(
    dataset_id: str,
    normalized_dir: Path,
) -> dict:

    issues = []

    # Load all recognized normalized tables.
    tables, loading_issues = load_normalized_tables(
        normalized_dir
    )

    issues.extend(loading_issues)

    # Inspect structure, values, keys and relationships.
    integrity_report = inspect_data_integrity(
        tables,
        issues,
    )

    # Determine which system modules can safely use the dataset.
    workspace_compatibility = assess_workspace_compatibility(
        tables,
        issues,
    )

    quality = calculate_quality_score(issues)

    ready_workspaces = [
        workspace
        for workspace, result in workspace_compatibility.items()
        if result["compatible"]
    ]

    unavailable_workspaces = [
        workspace
        for workspace, result in workspace_compatibility.items()
        if not result["compatible"]
    ]

    total_rows = sum(
        len(df)
        for df in tables.values()
    )

    total_errors = quality["error_count"]
    total_warnings = quality["warning_count"]

    # Errors that cannot be associated with a particular table
    # are treated as global blocking errors.
    global_errors = [
        issue
        for issue in issues
        if (
            issue.get("severity") == "error"
            and issue.get("table") is None
        )
    ]

    # A dataset can be approved when at least one workspace
    # is compatible. Errors in unrelated tables do not
    # automatically disable otherwise compatible workspaces.
    approval_eligible = (
        len(ready_workspaces) > 0
        and len(global_errors) == 0
    )

    if approval_eligible:
        assessment_status = "PASS"
    else:
        assessment_status = "REVIEW_REQUIRED"

    table_count = len(tables)

    report = {
        "dataset_id": dataset_id,
        "status": assessment_status,

        "quality_score": quality["score"],
        "quality_grade": quality["grade"],

        "summary": {
            "tables_detected": table_count,
            "total_rows": total_rows,
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "ready_workspaces": len(ready_workspaces),
            "unavailable_workspaces": len(
                unavailable_workspaces
            ),
        },

        "scoring": quality,

        "tables": integrity_report["tables"],

        "relationships": integrity_report["relationships"],

        "issues": issues,

        "workspace_compatibility": workspace_compatibility,

        "ready_workspaces": ready_workspaces,

        "unavailable_workspaces": unavailable_workspaces,

        "approval_eligible": approval_eligible,

        # Quality assessment never activates or approves a dataset.
        # Explicit approval must happen through the API.
        "activation_allowed": False,

        "approval_note": (
            "The dataset can be approved for the workspaces "
            "marked READY. Workspaces marked UNAVAILABLE must "
            "remain disabled until their required data issues "
            "are resolved. Explicit approval is still required."
        ),
    }

    return report


# ============================================================
# SERVICE LEVEL WORKSPACE & APPROVAL OPERATIONS
# ============================================================

def run_dataset_quality_check(dataset_id: str) -> dict:
    """
    Execute data quality and workspace compatibility assessment
    for a normalized uploaded dataset and persist the report.
    """
    dataset = get_dataset(dataset_id)
    if dataset is None:
        raise ValueError(f"Dataset '{dataset_id}' does not exist.")

    if dataset.get("type") != "uploaded":
        raise ValueError("Quality checks can only be run for uploaded datasets.")

    if dataset.get("normalization_status") != "completed":
        raise ValueError("Dataset must be normalized before running quality assessment.")

    normalized_dir = Path(UPLOADS_DIR) / dataset_id / "normalized"
    if not normalized_dir.exists():
        raise ValueError("Normalized dataset directory does not exist.")

    report = assess_dataset_quality(dataset_id=dataset_id, normalized_dir=normalized_dir)

    quality_score = report.get("quality_score", 0)
    quality_grade = report.get("quality_grade", "F")
    status = report.get("status", "REVIEW_REQUIRED")
    approval_eligible = report.get("approval_eligible", False)
    ready_workspaces = report.get("ready_workspaces", [])

    update_dataset(
        dataset_id,
        {
            "quality_report": report,
            "quality_status": status,
            "quality_score": quality_score,
            "quality_grade": quality_grade,
            "approval_eligible": approval_eligible,
            "ready_workspaces": ready_workspaces,
            "quality_checked_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "success": True,
        "message": "Dataset quality assessment completed.",
        "dataset_id": dataset_id,
        **report,
    }


def get_dataset_quality_report(dataset_id: str) -> dict:
    """
    Retrieve the saved quality and workspace compatibility report.
    """
    dataset = get_dataset(dataset_id)
    if dataset is None:
        raise ValueError(f"Dataset '{dataset_id}' does not exist.")

    report = dataset.get("quality_report")
    if not report:
        return {
            "dataset_id": dataset_id,
            "quality_status": "pending",
            "message": "Quality assessment has not been completed.",
        }

    return report


def approve_dataset(dataset_id: str) -> dict:
    """
    Explicitly approve a quality-checked dataset for activation.
    Persists approval status and approved_workspaces so the workspace
    access controller permits usage of compatible workspaces.
    """
    dataset = get_dataset(dataset_id)
    if dataset is None:
        raise ValueError(f"Dataset '{dataset_id}' does not exist.")

    if dataset.get("type") != "uploaded":
        raise ValueError("Only uploaded datasets can be approved.")

    if dataset.get("normalization_status") != "completed":
        raise ValueError("Dataset normalization must be completed before approval.")

    report = dataset.get("quality_report")
    if not report:
        raise ValueError("Run data quality assessment before approving this dataset.")

    if not report.get("approval_eligible", False):
        raise ValueError(
            "This dataset is not eligible for approval. "
            "Resolve the blocking issues and run quality assessment again."
        )

    approved_workspaces = report.get("ready_workspaces", [])
    approved_at = datetime.now(timezone.utc).isoformat()

    update_dataset(
        dataset_id,
        {
            "status": "ready",
            "approved": True,
            "approved_at": approved_at,
            "approval_eligible": True,
            "approved_workspaces": approved_workspaces,
        },
    )

    return {
        "success": True,
        "message": "Dataset approved successfully.",
        "dataset_id": dataset_id,
        "status": "ready",
        "approved": True,
        "approved_at": approved_at,
        "approval_eligible": True,
        "approved_workspaces": approved_workspaces,
        "ready_workspaces": approved_workspaces,
    }


def get_active_workspace_compatibility() -> dict:
    """
    Return workspace compatibility for the currently active dataset.
    Synthetic demo retains all 5 workspaces as READY.
    Uploaded datasets return assessed compatibility.
    """
    dataset = get_active_dataset()

    if dataset.get("type") == "synthetic":
        workspace_names = [
            "forecasting",
            "inventory",
            "optimization",
            "suppliers",
            "scenarios",
        ]

        compatibility = {
            workspace: {
                "compatible": True,
                "status": "READY",
                "reason": "Synthetic demo dataset supports this workspace.",
            }
            for workspace in workspace_names
        }
    else:
        quality_report = dataset.get("quality_report") or {}
        compatibility = quality_report.get(
            "workspace_compatibility",
            {},
        )

    return {
        "dataset_id": dataset.get("id"),
        "dataset_name": dataset.get("name"),
        "dataset_type": dataset.get("type"),
        "dataset_status": dataset.get("status"),
        "workspace_compatibility": compatibility,
        "ready_workspaces": [
            name
            for name, result in compatibility.items()
            if result.get("compatible") is True
        ],
        "available": bool(compatibility),
    }
