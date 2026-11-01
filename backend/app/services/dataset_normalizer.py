
"""
GRIDSTOCK AI
Dataset Normalization Engine

Converts uploaded CSV/Excel tables into canonical GridStock
CSV files using confirmed column mappings.

Safety:
- Original files remain unchanged.
- Synthetic Demo is never modified.
- Missing required values are not fabricated.
- Invalid records cause normalization to fail.
- Normalized files are published only after all mapped
  tables pass validation.
- Dataset activation is handled separately.
"""

import json
import re
import shutil
import uuid

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.core.dataset_manager import (
    UPLOADS_DIR,
    get_dataset,
    update_dataset,
)

from app.services.dataset_intelligence import (
    CANONICAL_SCHEMAS,
    validate_table_mapping,
)


# ============================================================
# FIELD DEFINITIONS
# ============================================================

DATE_FIELDS = {
    "date",
    "week_start",
    "order_date",
    "expected_arrival_date",
    "actual_arrival_date",
    "as_of_date",
}

NUMERIC_FIELDS = {
    "quantity",
    "quantity_consumed",
    "unit_cost",
    "lead_time_days",
    "latitude",
    "longitude",
    "opening_stock",
    "opening_quantity",
    "closing_stock",
    "requested_quantity",
    "issued_quantity",
    "received_quantity",
    "unmet_quantity",
    "outstanding_quantity",
    "overdue_quantity",
    "dependable_pipeline_quantity",
    "inventory_position",
    "reorder_point",
    "target_stock",
    "stock_cover_days",
    "ordered_quantity",
    "expected_lead_time_days",
    "actual_lead_time_days",
    "total_cost",
    "emergency_replenishment",
}

BOOLEAN_FIELDS = {
    "is_delayed",
    "is_emergency",
}

IDENTIFIER_FIELDS = {
    "item_code",
    "location_code",
    "supplier_code",
    "po_id",
    "transaction_id",
    "reference_id",
}

NONNEGATIVE_FIELDS = {
    "quantity",
    "quantity_consumed",
    "unit_cost",
    "lead_time_days",
    "opening_stock",
    "opening_quantity",
    "closing_stock",
    "requested_quantity",
    "issued_quantity",
    "received_quantity",
    "unmet_quantity",
    "outstanding_quantity",
    "overdue_quantity",
    "dependable_pipeline_quantity",
    "reorder_point",
    "target_stock",
    "stock_cover_days",
    "ordered_quantity",
    "expected_lead_time_days",
    "actual_lead_time_days",
    "total_cost",
    "emergency_replenishment",
}

TRUE_VALUES = {
    "true", "1", "yes", "y", "t",
}

FALSE_VALUES = {
    "false", "0", "no", "n", "f",
}


# ============================================================
# HELPERS
# ============================================================

def _now():
    return datetime.now(timezone.utc).isoformat()


def _clean_text(value):
    if pd.isna(value):
        return pd.NA

    text = str(value).strip()

    if not text or text.lower() in {
        "nan", "none", "null", "nat"
    }:
        return pd.NA

    return text


def _read_source_table(
    source_path: Path,
    sheet_name: str,
) -> pd.DataFrame:
    """
    Read an original uploaded table.

    CSV uses the logical sheet name Sheet1.
    Excel uses the actual worksheet name.
    """

    extension = source_path.suffix.lower()

    if extension == ".csv":
        if sheet_name != "Sheet1":
            raise ValueError(
                f"CSV source {source_path.name} must use Sheet1."
            )

        try:
            return pd.read_csv(
                source_path,
                encoding="utf-8-sig",
                dtype=str,
                keep_default_na=False,
            )

        except UnicodeDecodeError:
            return pd.read_csv(
                source_path,
                encoding="latin-1",
                dtype=str,
                keep_default_na=False,
            )

    if extension == ".xlsx":
        return pd.read_excel(
            source_path,
            sheet_name=sheet_name,
            dtype=str,
            keep_default_na=False,
            engine="openpyxl",
        )

    raise ValueError(
        f"Unsupported source format: {extension}"
    )


def _normalize_dates(
    dataframe: pd.DataFrame,
    errors: list,
):
    for field in DATE_FIELDS.intersection(dataframe.columns):

        original = dataframe[field].map(_clean_text)

        converted = pd.to_datetime(
            original,
            errors="coerce",
        )

        invalid = (
            original.notna()
            & converted.isna()
        )

        if invalid.any():
            errors.append({
                "field": field,
                "type": "invalid_date",
                "count": int(invalid.sum()),
                "sample_rows": (
                    dataframe.index[invalid][:5] + 2
                ).tolist(),
            })

        dataframe[field] = converted.dt.strftime(
            "%Y-%m-%d"
        )


def _normalize_numbers(
    dataframe: pd.DataFrame,
    errors: list,
):
    for field in NUMERIC_FIELDS.intersection(
        dataframe.columns
    ):

        original = dataframe[field].map(_clean_text)

        cleaned = original.astype("string").str.replace(
            ",",
            "",
            regex=False,
        )

        converted = pd.to_numeric(
            cleaned,
            errors="coerce",
        )

        invalid = (
            original.notna()
            & converted.isna()
        )

        if invalid.any():
            errors.append({
                "field": field,
                "type": "invalid_number",
                "count": int(invalid.sum()),
                "sample_rows": (
                    dataframe.index[invalid][:5] + 2
                ).tolist(),
            })

        if field in NONNEGATIVE_FIELDS:
            negative = converted.lt(0).fillna(False)

            if negative.any():
                errors.append({
                    "field": field,
                    "type": "negative_value",
                    "count": int(negative.sum()),
                    "sample_rows": (
                        dataframe.index[negative][:5] + 2
                    ).tolist(),
                })

        dataframe[field] = converted


def _normalize_booleans(
    dataframe: pd.DataFrame,
    errors: list,
):
    for field in BOOLEAN_FIELDS.intersection(
        dataframe.columns
    ):

        original = dataframe[field].map(_clean_text)

        normalized = original.astype(
            "string"
        ).str.lower()

        true_mask = normalized.isin(TRUE_VALUES)
        false_mask = normalized.isin(FALSE_VALUES)

        invalid = (
            original.notna()
            & ~(true_mask | false_mask)
        )

        if invalid.any():
            errors.append({
                "field": field,
                "type": "invalid_boolean",
                "count": int(invalid.sum()),
                "sample_rows": (
                    dataframe.index[invalid][:5] + 2
                ).tolist(),
            })

        result = pd.Series(
            pd.NA,
            index=dataframe.index,
            dtype="boolean",
        )

        result.loc[true_mask] = True
        result.loc[false_mask] = False

        dataframe[field] = result


def _normalize_strings(dataframe: pd.DataFrame):
    for field in dataframe.columns:
        if (
            field not in DATE_FIELDS
            and field not in NUMERIC_FIELDS
            and field not in BOOLEAN_FIELDS
        ):
            dataframe[field] = dataframe[field].map(
                _clean_text
            )


def _check_required_values(
    dataframe: pd.DataFrame,
    table_name: str,
    errors: list,
):
    required = CANONICAL_SCHEMAS[
        table_name
    ]["required"]

    for field in required:
        if field not in dataframe.columns:
            errors.append({
                "field": field,
                "type": "missing_required_column",
            })
            continue

        missing = dataframe[field].isna()

        if missing.any():
            errors.append({
                "field": field,
                "type": "missing_required_values",
                "count": int(missing.sum()),
                "sample_rows": (
                    dataframe.index[missing][:5] + 2
                ).tolist(),
            })


def _check_duplicate_keys(
    dataframe: pd.DataFrame,
    table_name: str,
    errors: list,
):
    """
    Check natural keys only for tables where the
    schema clearly identifies unique records.
    """

    unique_keys = {
        "materials": ["item_code"],
        "locations": ["location_code"],
        "suppliers": ["supplier_code"],
        "purchase_orders": ["po_id"],
        "opening_balances": [
            "item_code",
            "location_code",
        ],
        "weekly_inventory": [
            "week_start",
            "item_code",
            "location_code",
        ],
    }

    keys = unique_keys.get(table_name)

    if not keys:
        return

    if not all(key in dataframe.columns for key in keys):
        return

    duplicates = dataframe.duplicated(
        subset=keys,
        keep=False,
    )

    if duplicates.any():
        errors.append({
            "type": "duplicate_record_key",
            "fields": keys,
            "count": int(duplicates.sum()),
            "sample_rows": (
                dataframe.index[duplicates][:5] + 2
            ).tolist(),
        })


# ============================================================
# NORMALIZE ONE TABLE
# ============================================================

def normalize_table(
    dataframe: pd.DataFrame,
    table_name: str,
    mapping: dict[str, str],
) -> tuple[pd.DataFrame, dict]:
    """
    Apply confirmed column mapping and normalize types.

    Mapping:
        canonical_column -> uploaded_column
    """

    if table_name not in CANONICAL_SCHEMAS:
        raise ValueError(
            f"Unknown canonical table: {table_name}"
        )

    if dataframe.empty:
        raise ValueError(
            f"Source table for {table_name} is empty."
        )

    dataframe = dataframe.copy()

    dataframe.columns = [
        str(column)
        for column in dataframe.columns
    ]

    validation = validate_table_mapping(
        table_name,
        list(dataframe.columns),
        mapping,
    )

    if not validation["valid"]:
        raise ValueError(
            f"Invalid mapping for {table_name}: "
            f"{validation['errors']}"
        )

    selected_columns = {
        uploaded: canonical
        for canonical, uploaded in mapping.items()
    }

    normalized = dataframe[
        list(selected_columns.keys())
    ].rename(
        columns=selected_columns
    ).copy()

    schema = CANONICAL_SCHEMAS[table_name]

    canonical_order = (
        schema["required"] + schema["optional"]
    )

    normalized = normalized[
        [
            field
            for field in canonical_order
            if field in normalized.columns
        ]
    ]

    errors = []
    warnings = []

    _normalize_strings(normalized)
    _normalize_dates(normalized, errors)
    _normalize_numbers(normalized, errors)
    _normalize_booleans(normalized, errors)

    _check_required_values(
        normalized,
        table_name,
        errors,
    )

    _check_duplicate_keys(
        normalized,
        table_name,
        errors,
    )

    optional_missing = [
        field
        for field in schema["optional"]
        if field not in normalized.columns
    ]

    if optional_missing:
        warnings.append({
            "type": "optional_fields_not_provided",
            "fields": optional_missing,
        })

    report = {
        "table": table_name,
        "valid": not errors,
        "row_count": int(len(normalized)),
        "column_count": int(len(normalized.columns)),
        "errors": errors,
        "warnings": warnings,
    }

    return normalized, report


# ============================================================
# DATASET NORMALIZATION
# ============================================================

def normalize_uploaded_dataset(
    dataset_id: str,
) -> dict:
    """
    Normalize every confirmed table for an uploaded dataset.

    Writes canonical CSVs only if every mapped table
    passes normalization validation.
    """

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(
            f"Dataset '{dataset_id}' does not exist."
        )

    if dataset.get("type") != "uploaded":
        raise ValueError(
            "Only uploaded datasets can be normalized."
        )

    if dataset.get("status") not in {
        "review",
        "validation_failed",
    }:
        raise ValueError(
            "Dataset must be in review status "
            "before normalization."
        )

    validation_report = dataset.get(
        "validation_report"
    )

    if (
        not validation_report
        or not validation_report.get("valid")
        or not validation_report.get(
            "normalization_ready"
        )
    ):
        raise ValueError(
            "Confirmed mappings must pass structural "
            "validation before normalization."
        )

    mappings = dataset.get(
        "confirmed_mappings",
        [],
    )

    if not mappings:
        raise ValueError(
            "No confirmed mappings are available."
        )

    dataset_root = UPLOADS_DIR / dataset_id

    original_dir = dataset_root / "original"
    normalized_dir = dataset_root / "normalized"

    staging_dir = (
        dataset_root
        / f".normalizing_{uuid.uuid4().hex[:8]}"
    )

    staging_dir.mkdir(
        parents=True,
        exist_ok=False,
    )

    reports = []
    errors = []
    lineage = []
    published_files = []

    try:
        for confirmed in mappings:

            stored_filename = confirmed["file"]
            sheet_name = confirmed["sheet"]
            table_name = confirmed["table_name"]
            column_mapping = confirmed["mapping"]

            # Confirm the file belongs to this dataset.
            registered_files = {
                item["stored_filename"]
                for item in dataset.get("files", [])
            }

            if stored_filename not in registered_files:
                raise ValueError(
                    f"Unregistered source file: "
                    f"{stored_filename}"
                )

            # Reject directory traversal.
            if Path(stored_filename).name != stored_filename:
                raise ValueError(
                    "Invalid stored filename."
                )

            source_path = (
                original_dir / stored_filename
            )

            if not source_path.is_file():
                raise FileNotFoundError(
                    f"Original file not found: "
                    f"{stored_filename}"
                )

            source_dataframe = _read_source_table(
                source_path,
                sheet_name,
            )

            normalized, report = normalize_table(
                source_dataframe,
                table_name,
                column_mapping,
            )

            report["source_file"] = stored_filename
            report["source_sheet"] = sheet_name

            reports.append(report)

            if not report["valid"]:
                errors.append({
                    "table": table_name,
                    "source_file": stored_filename,
                    "errors": report["errors"],
                })
                continue

            output_filename = (
                f"{table_name}.csv"
            )

            output_path = (
                staging_dir / output_filename
            )

            normalized.to_csv(
                output_path,
                index=False,
                encoding="utf-8-sig",
            )

            published_files.append(output_filename)

            lineage.append({
                "canonical_table": table_name,
                "normalized_file": output_filename,
                "source_file": stored_filename,
                "source_sheet": sheet_name,
                "column_mapping": column_mapping,
                "row_count": int(len(normalized)),
                "normalized_at": _now(),
            })

        if errors:
            report = {
                "dataset_id": dataset_id,
                "valid": False,
                "normalized_tables": 0,
                "errors": errors,
                "tables": reports,
                "activation_allowed": False,
            }

            update_dataset(
                dataset_id,
                {
                    "normalization_report": report,
                    "status": "validation_failed",
                },
            )

            return report

        # Save lineage alongside normalized data.
        lineage_path = (
            staging_dir / "lineage.json"
        )

        with lineage_path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                {
                    "dataset_id": dataset_id,
                    "created_at": _now(),
                    "tables": lineage,
                },
                file,
                indent=4,
            )

        # Publish only after all tables pass validation.
        # A backup preserves the previous normalized folder.
        backup_dir = (
            dataset_root
            / f".normalized_backup_{uuid.uuid4().hex[:8]}"
        )

        if normalized_dir.exists():
            normalized_dir.rename(backup_dir)

        try:
            staging_dir.rename(normalized_dir)

        except Exception:
            if backup_dir.exists():
                backup_dir.rename(normalized_dir)
            raise

        if backup_dir.exists():
            shutil.rmtree(backup_dir)

        report = {
            "dataset_id": dataset_id,
            "valid": True,
            "normalized_tables": len(published_files),
            "files": published_files,
            "tables": reports,
            "lineage": lineage,
            "activation_allowed": False,
            "next_step": (
                "Run dataset-level quality checks and "
                "workspace compatibility validation."
            ),
        }

        update_dataset(
            dataset_id,
            {
                "normalization_report": report,
                "normalization_status": "completed",
                "status": "review",
            },
        )

        return report

    finally:
        if staging_dir.exists():
            shutil.rmtree(staging_dir)


# ============================================================
# NORMALIZATION REPORT
# ============================================================

def get_normalization_report(
    dataset_id: str,
) -> dict:
    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(
            f"Dataset '{dataset_id}' does not exist."
        )

    report = dataset.get(
        "normalization_report"
    )

    if report is None:
        raise ValueError(
            "This dataset has not been normalized yet."
        )

    return report
