"""
GRIDSTOCK AI
Dataset Intelligence Service

Identifies uploaded dataset tables, suggests canonical
column mappings, and validates their structural compatibility
with GridStock AI.

Supports:
- CSV files
- Excel workbook sheets
- Flexible column naming
- Table recognition
- Schema mapping suggestions
- Structural validation

Important:
Suggested mappings are not automatically approved.
User confirmation is required before normalization.
"""

import re
from typing import Any

from app.core.dataset_manager import get_dataset


# ============================================================
# CANONICAL GRIDSTOCK SCHEMAS
# ============================================================

CANONICAL_SCHEMAS = {

    "materials": {
        "description": "Material master information",

        "required": [
            "item_code",
            "item_name",
            "category",
            "unit",
            "criticality",
            "unit_cost",
            "lead_time_days",
        ],

        "optional": [
            "description",
        ],
    },

    "locations": {
        "description": "Utility storage and operational locations",

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
        "description": "Supplier master information",

        "required": [
            "supplier_code",
            "supplier_name",
        ],

        "optional": [
            "contact_person",
            "email",
            "phone",
            "address",
        ],
    },

        "consumption": {
        "description": "Historical material consumption records",

        "required": [
            "week_start",
            "item_code",
            "location_code",
            "quantity_consumed",
        ],

        "optional": [
            "transaction_id",
            "source",
            "demand_type",
            "is_spike",
            "unit",
        ],
    },

        "opening_balances": {
        "description": "Opening inventory balances",

        "required": [
            "item_code",
            "location_code",
            "opening_quantity",
        ],

        "optional": [
            "as_of_date",
            "week_start",
            "unit",
            "source",
        ],
    },

    "stock_movements": {
        "description": "Inventory receipt and issue transactions",

        "required": [
            "date",
            "item_code",
            "location_code",
            "movement_type",
            "quantity",
        ],

        "optional": [
            "reference_id",
            "unit",
            "source",
        ],
    },

    "purchase_orders": {
        "description": "Procurement and purchase order records",

        "required": [
            "po_id",
            "order_date",
            "item_code",
            "location_code",
            "supplier_code",
            "ordered_quantity",
            "status",
        ],

        "optional": [
            "expected_arrival_date",
            "actual_arrival_date",
            "expected_lead_time_days",
            "actual_lead_time_days",
            "is_delayed",
            "is_emergency",
            "unit_cost",
            "total_cost",
            "source",
        ],
    },

    "weekly_inventory": {
        "description": "Weekly inventory position and stock records",

        "required": [
            "week_start",
            "item_code",
            "location_code",
            "opening_stock",
            "closing_stock",
            "requested_quantity",
            "issued_quantity",
        ],

        "optional": [
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
            "emergency_replenishment",
            "unit",
            "source",
        ],
    },
}


# ============================================================
# COLUMN ALIASES
# ============================================================

COLUMN_ALIASES = {

    # General identifiers
    "item_code": [
        "item_code",
        "material_code",
        "material_id",
        "item_id",
        "sku",
        "product_code",
        "material_number",
        "material_no",
    ],

    "item_name": [
        "item_name",
        "material_name",
        "material_description",
        "item_description",
        "product_name",
        "description",
    ],

    "location_code": [
        "location_code",
        "location_id",
        "site_code",
        "site_id",
        "store_code",
        "warehouse_code",
        "plant_code",
    ],

    "location_name": [
        "location_name",
        "site_name",
        "store_name",
        "warehouse_name",
        "plant_name",
    ],

    "supplier_code": [
        "supplier_code",
        "supplier_id",
        "vendor_code",
        "vendor_id",
        "vendor_number",
    ],

    "supplier_name": [
        "supplier_name",
        "vendor_name",
        "vendor",
        "supplier",
    ],

    # Material attributes
    "category": [
        "category",
        "material_category",
        "item_category",
        "product_category",
        "material_group",
    ],

    "unit": [
        "unit",
        "uom",
        "unit_of_measure",
        "measurement_unit",
    ],

    "criticality": [
        "criticality",
        "criticality_level",
        "priority",
        "material_criticality",
    ],

    "unit_cost": [
        "unit_cost",
        "cost_per_unit",
        "price_per_unit",
        "rate",
        "unit_price",
    ],

    "lead_time_days": [
        "lead_time_days",
        "lead_time",
        "procurement_lead_time",
        "delivery_lead_time_days",
    ],

    # Time and consumption
    "date": [
        "date",
        "transaction_date",
        "consumption_date",
        "issue_date",
        "record_date",
        "timestamp",
    ],

        "week_start": [
        "week_start",
        "date",
        "week_date",
        "week",
        "week_commencing",
        "timestamp",
        "transaction_date",
        "consumption_date",
    ],

    "quantity": [
        "quantity",
        "qty",
        "transaction_quantity",
    ],

    "quantity_consumed": [
        "quantity_consumed",
        "quantity",
        "qty",
        "consumed_quantity",
        "consumption_quantity",
        "consumption",
    ],

    "demand_type": [
        "demand_type",
        "consumption_type",
        "demand_category",
        "usage_type",
    ],

    "transaction_id": [
        "transaction_id",
        "transaction_number",
        "movement_id",
        "record_id",
    ],

    # Inventory
    "opening_stock": [
        "opening_stock",
        "opening_balance",
        "initial_stock",
        "beginning_stock",
        "opening_quantity",
    ],

        "opening_quantity": [
        "opening_quantity",
        "opening_stock",
        "opening_balance",
        "initial_stock",
        "beginning_stock",
    ],

    "closing_stock": [
        "closing_stock",
        "closing_balance",
        "ending_stock",
        "final_stock",
        "available_stock",
    ],

    "requested_quantity": [
        "requested_quantity",
        "requested_qty",
        "demand_quantity",
        "required_quantity",
    ],

    "issued_quantity": [
        "issued_quantity",
        "issued_qty",
        "consumed_quantity",
        "issue_quantity",
    ],

    "received_quantity": [
        "received_quantity",
        "received_qty",
        "receipt_quantity",
        "inward_quantity",
    ],

    "unmet_quantity": [
        "unmet_quantity",
        "unfulfilled_quantity",
        "shortage_quantity",
        "backorder_quantity",
    ],

    "outstanding_quantity": [
        "outstanding_quantity",
        "pending_quantity",
        "open_quantity",
    ],

    "overdue_quantity": [
        "overdue_quantity",
        "delayed_quantity",
    ],

    "dependable_pipeline_quantity": [
        "dependable_pipeline_quantity",
        "pipeline_quantity",
        "confirmed_pipeline",
    ],

    "inventory_position": [
        "inventory_position",
        "stock_position",
        "net_inventory",
    ],

    "reorder_point": [
        "reorder_point",
        "rop",
        "reorder_level",
        "minimum_stock_level",
    ],

    "target_stock": [
        "target_stock",
        "maximum_stock",
        "desired_stock",
        "target_inventory",
    ],

    "stock_cover_days": [
        "stock_cover_days",
        "days_of_inventory",
        "inventory_cover_days",
        "days_cover",
    ],

    # Stock movements
    "movement_type": [
        "movement_type",
        "transaction_type",
        "stock_movement_type",
        "movement",
    ],

    "reference_id": [
        "reference_id",
        "reference_number",
        "document_number",
    ],

    # Purchase orders
    "po_id": [
        "po_id",
        "purchase_order_id",
        "po_number",
        "purchase_order_number",
        "order_id",
    ],

    "order_date": [
        "order_date",
        "po_date",
        "purchase_date",
        "created_date",
    ],

    "expected_arrival_date": [
        "expected_arrival_date",
        "expected_delivery_date",
        "promised_date",
        "scheduled_delivery_date",
    ],

    "actual_arrival_date": [
        "actual_arrival_date",
        "actual_delivery_date",
        "received_date",
        "delivery_date",
    ],

    "ordered_quantity": [
        "ordered_quantity",
        "order_quantity",
        "po_quantity",
        "ordered_qty",
    ],

    "status": [
        "status",
        "order_status",
        "po_status",
        "delivery_status",
    ],

    "expected_lead_time_days": [
        "expected_lead_time_days",
        "expected_lead_time",
        "planned_lead_time",
    ],

    "actual_lead_time_days": [
        "actual_lead_time_days",
        "actual_lead_time",
        "realized_lead_time",
    ],

    "is_delayed": [
        "is_delayed",
        "delayed",
        "late_delivery",
        "delivery_delayed",
    ],

    "is_emergency": [
        "is_emergency",
        "emergency_order",
        "urgent_order",
        "emergency",
    ],

    "total_cost": [
        "total_cost",
        "order_value",
        "total_amount",
        "purchase_value",
    ],

    "emergency_replenishment": [
        "emergency_replenishment",
        "emergency_replenishment_quantity",
    ],

    # General optional attributes
    "source": [
        "source",
        "data_source",
        "record_source",
    ],

    "region": [
        "region",
        "zone",
        "operational_region",
    ],

    "latitude": [
        "latitude",
        "lat",
    ],

    "longitude": [
        "longitude",
        "long",
        "lng",
    ],

    "contact_person": [
        "contact_person",
        "contact_name",
        "representative",
    ],

    "email": [
        "email",
        "email_address",
        "contact_email",
    ],

    "phone": [
        "phone",
        "phone_number",
        "mobile",
        "contact_number",
    ],

    "address": [
        "address",
        "supplier_address",
        "location_address",
    ],
}


# ============================================================
# NORMALIZATION UTILITIES
# ============================================================

def normalize_column_name(value: Any) -> str:
    """Convert column names into comparable identifiers."""

    value = str(value).strip().lower()

    value = re.sub(
        r"[^a-z0-9]+",
        "_",
        value,
    )

    return value.strip("_")


def get_aliases(canonical_column: str) -> list[str]:
    """Return normalized aliases for a canonical column."""

    aliases = COLUMN_ALIASES.get(
        canonical_column,
        [canonical_column],
    )

    return list({
        normalize_column_name(alias)
        for alias in aliases
    })


# ============================================================
# COLUMN MAPPING
# ============================================================

def suggest_column_mapping(
    uploaded_columns: list[str],
    canonical_columns: list[str],
) -> dict:
    """
    Suggest mappings between uploaded and canonical columns.

    Exact normalized matches are preferred over aliases.

    Ambiguous matches are not automatically selected.
    """

    normalized_columns = {
        normalize_column_name(column): column
        for column in uploaded_columns
    }

    mapping = {}
    unmapped_columns = []
    ambiguous_columns = []

    used_uploaded_columns = set()

    for canonical_column in canonical_columns:

        aliases = get_aliases(canonical_column)

        # Exact canonical match.
        if canonical_column in normalized_columns:
            original_column = normalized_columns[
                canonical_column
            ]

            if original_column not in used_uploaded_columns:
                mapping[canonical_column] = {
                    "uploaded_column": original_column,
                    "confidence": 1.0,
                    "match_type": "exact",
                    "status": "suggested",
                }

                used_uploaded_columns.add(original_column)
                continue

        # Alias matching.
        matches = []

        for alias in aliases:
            if alias in normalized_columns:
                original_column = normalized_columns[alias]

                if original_column not in used_uploaded_columns:
                    matches.append(original_column)

        matches = list(dict.fromkeys(matches))

        if len(matches) == 1:
            mapping[canonical_column] = {
                "uploaded_column": matches[0],
                "confidence": 0.95,
                "match_type": "alias",
                "status": "suggested",
            }

            used_uploaded_columns.add(matches[0])

        elif len(matches) > 1:
            ambiguous_columns.append({
                "canonical_column": canonical_column,
                "possible_matches": matches,
            })

        else:
            unmapped_columns.append(canonical_column)

    return {
        "mapping": mapping,
        "unmapped_columns": unmapped_columns,
        "ambiguous_columns": ambiguous_columns,
        "unused_uploaded_columns": [
            column
            for column in uploaded_columns
            if column not in used_uploaded_columns
        ],
    }


# ============================================================
# TABLE RECOGNITION
# ============================================================

def identify_table(
    filename: str,
    sheet_name: str,
    columns: list[str],
) -> dict:
    """Identify the most likely canonical GridStock table."""

    normalized_filename = normalize_column_name(
        filename.rsplit(".", 1)[0]
    )

    normalized_sheet = normalize_column_name(
        sheet_name
    )

    combined_name = (
        normalized_filename + "_" + normalized_sheet
    )

    name_aliases = {
        "materials": [
            "materials",
            "material_master",
            "item_master",
            "items",
        ],

        "locations": [
            "locations",
            "location_master",
            "sites",
            "warehouses",
        ],

        "suppliers": [
            "suppliers",
            "supplier_master",
            "vendors",
        ],

        "consumption": [
            "consumption",
            "demand_history",
            "usage_history",
            "material_consumption",
        ],

        "opening_balances": [
            "opening_balances",
            "opening_balance",
            "initial_inventory",
        ],

        "stock_movements": [
            "stock_movements",
            "inventory_movements",
            "movements",
        ],

        "purchase_orders": [
            "purchase_orders",
            "purchase_order",
            "purchase_orders_data",
            "po_data",
        ],

        "weekly_inventory": [
            "weekly_inventory",
            "inventory_history",
            "weekly_stock",
        ],
    }

    filename_candidates = []

    for table_name, aliases in name_aliases.items():
        if any(
            alias in combined_name
            for alias in aliases
        ):
            filename_candidates.append(table_name)

    # Build candidates using required and optional columns.
    column_candidates = []

    for table_name, schema in CANONICAL_SCHEMAS.items():

        required = schema["required"]

        result = suggest_column_mapping(
            columns,
            required,
        )

        matched_count = len(result["mapping"])

        score = matched_count / len(required)

        column_candidates.append({
            "table": table_name,
            "score": round(score, 3),
            "matched_required_columns": matched_count,
            "total_required_columns": len(required),
        })

    column_candidates.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    best_candidate = column_candidates[0]

    # Filename hints are only a tie-breaker.
    if filename_candidates:
        matching_candidates = [
            candidate
            for candidate in column_candidates
            if candidate["table"] in filename_candidates
        ]

        if matching_candidates:
            matching_candidates.sort(
                key=lambda item: item["score"],
                reverse=True,
            )

            if (
                matching_candidates[0]["score"]
                >= best_candidate["score"] - 0.05
            ):
                best_candidate = matching_candidates[0]

    second_score = (
        column_candidates[1]["score"]
        if len(column_candidates) > 1
        else 0
    )

    if best_candidate["score"] < 0.40:
        identified_table = None
        confidence = "low"

    elif (
        best_candidate["score"] == second_score
        and best_candidate["score"] < 1.0
    ):
        identified_table = None
        confidence = "ambiguous"

    else:
        identified_table = best_candidate["table"]

        if best_candidate["score"] >= 0.80:
            confidence = "high"
        elif best_candidate["score"] >= 0.60:
            confidence = "medium"
        else:
            confidence = "low"

    return {
        "identified_table": identified_table,
        "confidence": confidence,
        "filename_candidates": filename_candidates,
        "best_candidate": best_candidate,
        "candidate_scores": column_candidates,
    }


# ============================================================
# DATASET SCHEMA ANALYSIS
# ============================================================

def analyze_dataset_schema(dataset_id: str) -> dict:
    """
    Analyze the inspection profiles of an uploaded dataset.

    Produces suggested table recognition and column mappings.
    Does not modify the uploaded files or approve mappings.
    """

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(
            f"Dataset '{dataset_id}' does not exist."
        )

    if dataset.get("type") != "uploaded":
        raise ValueError(
            "Schema analysis is intended for uploaded datasets."
        )

    profile = dataset.get("profile", {})

    file_profiles = profile.get(
        "file_profiles",
        {},
    )

    if not file_profiles:
        raise ValueError(
            "No uploaded file profiles were found."
        )

    analyzed_tables = []

    for stored_filename, file_profile in file_profiles.items():

        for sheet_name, sheet_profile in file_profile.get(
            "sheets",
            {},
        ).items():

            uploaded_columns = [
                column["name"]
                for column in sheet_profile.get(
                    "columns",
                    [],
                )
            ]

            identification = identify_table(
                stored_filename,
                sheet_name,
                uploaded_columns,
            )

            identified_table = identification[
                "identified_table"
            ]

            if identified_table:
                schema = CANONICAL_SCHEMAS[
                    identified_table
                ]

                mapping_result = suggest_column_mapping(
                    uploaded_columns,
                    schema["required"] + schema["optional"],
                )

                required_mapping = suggest_column_mapping(
                    uploaded_columns,
                    schema["required"],
                )

                mapped_required = len(
                    required_mapping["mapping"]
                )

                total_required = len(
                    schema["required"]
                )

                completeness = round(
                    mapped_required / total_required * 100,
                    2,
                )

            else:
                mapping_result = {
                    "mapping": {},
                    "unmapped_columns": [],
                    "ambiguous_columns": [],
                    "unused_uploaded_columns": uploaded_columns,
                }

                completeness = 0

            analyzed_tables.append({
                "file": stored_filename,
                "sheet": sheet_name,

                "row_count": sheet_profile.get(
                    "row_count", 0
                ),

                "column_count": sheet_profile.get(
                    "column_count", 0
                ),

                "identified_table": identified_table,

                "identification_confidence": (
                    identification["confidence"]
                ),

                "candidate_scores": (
                    identification["candidate_scores"]
                ),

                "mapping": mapping_result["mapping"],

                "unmapped_columns": (
                    mapping_result["unmapped_columns"]
                ),

                "ambiguous_columns": (
                    mapping_result["ambiguous_columns"]
                ),

                "unused_uploaded_columns": (
                    mapping_result["unused_uploaded_columns"]
                ),

                "required_field_completeness_pct": completeness,

                "mapping_status": "suggested",
            })

    recognized_tables = [
        table
        for table in analyzed_tables
        if table["identified_table"]
    ]

    unidentified_tables = [
        table
        for table in analyzed_tables
        if not table["identified_table"]
    ]

    return {
        "dataset_id": dataset_id,

        "dataset_name": dataset.get("name"),

        "total_tables_inspected": len(analyzed_tables),

        "recognized_tables": len(recognized_tables),

        "unidentified_tables": len(unidentified_tables),

        "tables": analyzed_tables,

        "available_canonical_tables": list(
            CANONICAL_SCHEMAS.keys()
        ),

        "requires_user_confirmation": True,
    }


# ============================================================
# STRUCTURAL VALIDATION
# ============================================================

def validate_table_mapping(
    table_name: str,
    uploaded_columns: list[str],
    mapping: dict,
) -> dict:
    """
    Validate a proposed canonical table mapping.

    Mapping format:
    {
        "item_code": "Material Code",
        "item_name": "Material Name"
    }
    """

    if table_name not in CANONICAL_SCHEMAS:
        raise ValueError(
            f"Unsupported canonical table: {table_name}"
        )

    schema = CANONICAL_SCHEMAS[table_name]

    required = schema["required"]
    optional = schema["optional"]

    errors = []
    warnings = []

    allowed_fields = set(required + optional)

    unexpected_fields = [
        field
        for field in mapping
        if field not in allowed_fields
    ]

    if unexpected_fields:
        errors.append({
            "type": "unexpected_canonical_fields",
            "fields": unexpected_fields,
        })

    missing_required = [
        field
        for field in required
        if field not in mapping
    ]

    if missing_required:
        errors.append({
            "type": "missing_required_fields",
            "fields": missing_required,
        })

    invalid_uploaded_columns = [
        uploaded_column
        for uploaded_column in mapping.values()
        if uploaded_column not in uploaded_columns
    ]

    if invalid_uploaded_columns:
        errors.append({
            "type": "unknown_uploaded_columns",
            "fields": invalid_uploaded_columns,
        })

    valid_mapping_values = [
        uploaded_column
        for uploaded_column in mapping.values()
        if uploaded_column in uploaded_columns
    ]

    if len(valid_mapping_values) != len(
        set(valid_mapping_values)
    ):
        errors.append({
            "type": "duplicate_source_mapping",
            "message": (
                "One uploaded column cannot map to "
                "multiple canonical fields."
            ),
        })

    missing_optional = [
        field
        for field in optional
        if field not in mapping
    ]

    if missing_optional:
        warnings.append({
            "type": "missing_optional_fields",
            "fields": missing_optional,
        })

    return {
        "table": table_name,

        "valid": len(errors) == 0,

        "errors": errors,

        "warnings": warnings,

        "required_fields": required,

        "mapped_required_fields": [
            field
            for field in required
            if field in mapping
        ],

        "missing_required_fields": missing_required,

        "missing_optional_fields": missing_optional,
    }


# ============================================================
# COMPLETE DATASET VALIDATION SUMMARY
# ============================================================

def generate_dataset_validation_summary(
    analysis: dict,
) -> dict:
    """Summarize schema recognition and mapping readiness."""

    tables = analysis.get("tables", [])

    recognized = [
        table
        for table in tables
        if table.get("identified_table")
    ]

    unidentified = [
        table
        for table in tables
        if not table.get("identified_table")
    ]

    ready_candidates = [
        table
        for table in recognized
        if (
            table.get("required_field_completeness_pct", 0)
            == 100
            and not table.get("ambiguous_columns")
        )
    ]

    incomplete = [
        table
        for table in recognized
        if table.get("required_field_completeness_pct", 0) < 100
    ]

    return {
        "total_tables": len(tables),

        "recognized_tables": len(recognized),

        "unidentified_tables": len(unidentified),

        "complete_mapping_candidates": len(ready_candidates),

        "incomplete_mapping_candidates": len(incomplete),

        "recognized_table_names": [
            table["identified_table"]
            for table in recognized
        ],

        "unidentified_files": [
            {
                "file": table["file"],
                "sheet": table["sheet"],
            }
            for table in unidentified
        ],

        "activation_allowed": False,

        "reason": (
            "User confirmation, normalization and data "
            "validation are still required."
        ),
    }