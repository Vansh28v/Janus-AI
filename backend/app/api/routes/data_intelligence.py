
"""
GRIDSTOCK AI
Data Intelligence API

Handles:
- CSV and Excel uploads
- Dataset inspection
- Dataset listing and switching
- Schema recognition
- Column mapping confirmation
- Schema validation
- Dataset normalization
- Normalization reports

Uploaded datasets cannot be activated until normalization
and data-quality validation stages are completed.
"""

import json
from io import BytesIO
from pathlib import Path
from typing import List

import pandas as pd

from fastapi import (
    APIRouter,
    HTTPException,
    UploadFile,
    File,
    Form,
)

from pydantic import BaseModel, Field

from app.core.dataset_manager import (
    UPLOADS_DIR,
    list_datasets,
    get_dataset,
    get_active_dataset,
    set_active_dataset,
    register_uploaded_dataset,
    update_dataset,
)

from app.services.dataset_intelligence import (
    analyze_dataset_schema,
    validate_table_mapping,
    generate_dataset_validation_summary,
)


router = APIRouter(
    prefix="/api/data-intelligence",
    tags=["Data Intelligence"],
)


# ============================================================
# CONFIGURATION
# ============================================================

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_PREVIEW_ROWS = 5


# ============================================================
# REQUEST MODELS
# ============================================================

class TableMapping(BaseModel):
    file: str
    sheet: str
    table_name: str
    mapping: dict[str, str] = Field(default_factory=dict)


class MappingSubmission(BaseModel):
    mappings: List[TableMapping]


# ============================================================
# FILE INSPECTION
# ============================================================

def inspect_dataframe(df: pd.DataFrame) -> dict:
    """Generate a profile for an individual table or sheet."""

    columns = []

    for column in df.columns:
        series = df[column]

        columns.append({
            "name": str(column),
            "data_type": str(series.dtype),
            "missing_values": int(series.isna().sum()),
            "missing_percentage": round(
                float(series.isna().mean() * 100), 2
            ),
            "unique_values": int(series.nunique(dropna=True)),
        })

    preview = df.head(MAX_PREVIEW_ROWS).to_json(
        orient="records",
        date_format="iso",
        default_handler=str,
    )

    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "columns": columns,
        "duplicate_rows": int(df.duplicated().sum()),
        "preview": json.loads(preview),
        "empty": bool(df.empty),
    }


def inspect_uploaded_file(
    filename: str,
    content: bytes,
) -> dict:
    """Inspect CSV or Excel content."""

    extension = Path(filename).suffix.lower()

    if extension == ".csv":
        try:
            df = pd.read_csv(
                BytesIO(content),
                low_memory=False,
                encoding="utf-8-sig",
            )
        except UnicodeDecodeError:
            df = pd.read_csv(
                BytesIO(content),
                low_memory=False,
                encoding="latin-1",
            )

        return {
            "filename": filename,
            "format": "CSV",
            "sheets": {
                "Sheet1": inspect_dataframe(df)
            },
        }

    if extension == ".xlsx":
        try:
            excel_file = pd.ExcelFile(BytesIO(content))

            sheets = {}

            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(
                    excel_file,
                    sheet_name=sheet_name,
                )

                sheets[sheet_name] = inspect_dataframe(df)

            return {
                "filename": filename,
                "format": "EXCEL",
                "sheets": sheets,
            }

        except Exception as error:
            raise ValueError(
                f"Unable to read Excel file: {str(error)}"
            ) from error

    raise ValueError("Unsupported file format.")


# ============================================================
# DATASET LISTING
# ============================================================

@router.get("/datasets")
def get_datasets():
    """Return all registered datasets."""

    datasets = list_datasets()
    active_dataset = get_active_dataset()

    return {
        "datasets": datasets,
        "active_dataset_id": active_dataset["id"],
        "total_datasets": len(datasets),
    }


# ============================================================
# ACTIVE DATASET
# ============================================================

@router.get("/active")
def get_active_dataset_information():
    """Return the currently selected dataset."""

    dataset = get_active_dataset()

    return {
        "active_dataset": dataset,
        "dataset_id": dataset["id"],
        "dataset_name": dataset["name"],
        "dataset_type": dataset["type"],
    }


@router.post("/datasets/{dataset_id}/activate")
def activate_dataset(dataset_id: str):
    """Switch the active GridStock dataset."""

    try:
        dataset = set_active_dataset(dataset_id)

        return {
            "message": "Active dataset changed successfully.",
            "active_dataset": dataset,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )


# ============================================================
# DATASET DETAILS
# ============================================================

@router.get("/datasets/{dataset_id}")
def get_dataset_information(dataset_id: str):
    """Return dataset metadata and inspection profile."""

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    return {
        "dataset": dataset,
        "is_active": (
            get_active_dataset()["id"] == dataset_id
        ),
    }


# ============================================================
# DATASET UPLOAD
# ============================================================

@router.post("/upload")
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    files: List[UploadFile] = File(...),
):
    """Upload and inspect CSV or Excel files."""

    if not name.strip():
        raise HTTPException(
            status_code=422,
            detail="Dataset name cannot be empty.",
        )

    if not files:
        raise HTTPException(
            status_code=422,
            detail="Upload at least one CSV or Excel file.",
        )

    for uploaded_file in files:
        filename = Path(
            uploaded_file.filename or ""
        ).name

        extension = Path(filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Unsupported file: {filename}. "
                    "Only CSV and XLSX files are supported."
                ),
            )

    dataset = register_uploaded_dataset(
        name=name,
        description=description,
    )

    dataset_id = dataset["id"]

    original_dir = (
        UPLOADS_DIR / dataset_id / "original"
    )

    uploaded_files = []
    dataset_profiles = {}

    try:
        for index, uploaded_file in enumerate(files):

            original_filename = Path(
                uploaded_file.filename or ""
            ).name

            extension = Path(
                original_filename
            ).suffix.lower()

            content = await uploaded_file.read()

            if not content:
                raise ValueError(
                    f"{original_filename} is empty."
                )

            if len(content) > MAX_FILE_SIZE:
                raise ValueError(
                    f"{original_filename} exceeds the "
                    "25 MB file size limit."
                )

            stored_filename = (
                f"{index + 1}_{original_filename}"
            )

            stored_path = (
                original_dir / stored_filename
            )

            stored_path.write_bytes(content)

            profile = inspect_uploaded_file(
                original_filename,
                content,
            )

            dataset_profiles[stored_filename] = profile

            uploaded_files.append({
                "original_filename": original_filename,
                "stored_filename": stored_filename,
                "format": extension.replace(".", "").upper(),
                "size_bytes": len(content),
            })

        total_rows = 0
        total_sheets = 0

        for file_profile in dataset_profiles.values():
            for sheet_profile in file_profile["sheets"].values():
                total_rows += sheet_profile["row_count"]
                total_sheets += 1

        update_dataset(
            dataset_id,
            {
                "status": "review",
                "files": uploaded_files,
                "profile": {
                    "total_files": len(uploaded_files),
                    "total_sheets": total_sheets,
                    "total_rows": total_rows,
                    "file_profiles": dataset_profiles,
                },
            },
        )

        return {
            "message": (
                "Dataset uploaded and inspected successfully. "
                "Schema mapping and validation are required "
                "before activation."
            ),
            "dataset": get_dataset(dataset_id),
            "inspection": {
                "total_files": len(uploaded_files),
                "total_sheets": total_sheets,
                "total_rows": total_rows,
                "profiles": dataset_profiles,
            },
        }

    except Exception as error:

        update_dataset(
            dataset_id,
            {
                "status": "failed",
                "error": str(error),
            },
        )

        if isinstance(error, HTTPException):
            raise error

        raise HTTPException(
            status_code=422,
            detail=f"Dataset processing failed: {str(error)}",
        )

# ============================================================
# SCHEMA ANALYSIS
# ============================================================

@router.post("/datasets/{dataset_id}/analyze")
def analyze_uploaded_dataset(dataset_id: str):
    """Recognize uploaded tables and suggest column mappings."""

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    try:
        analysis = analyze_dataset_schema(dataset_id)

        update_dataset(
            dataset_id,
            {
                "schema_analysis": analysis,
            },
        )

        return {
            "message": "Schema analysis completed.",
            "analysis": analysis,
            "validation_summary": (
                generate_dataset_validation_summary(analysis)
            ),
        }

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Schema analysis failed: {str(error)}",
        )


# ============================================================
# RETRIEVE SCHEMA ANALYSIS
# ============================================================

@router.get("/datasets/{dataset_id}/analysis")
def get_schema_analysis(dataset_id: str):
    """Retrieve the latest saved schema analysis."""

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    analysis = dataset.get("schema_analysis")

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=(
                "Schema analysis has not been performed "
                "for this dataset."
            ),
        )

    return {
        "dataset_id": dataset_id,
        "analysis": analysis,
    }


# ============================================================
# CONFIRM COLUMN MAPPINGS
# ============================================================

@router.post("/datasets/{dataset_id}/mappings")
def submit_dataset_mappings(
    dataset_id: str,
    request: MappingSubmission,
):
    """
    Save user-confirmed column mappings.

    Each mapping identifies:
    - Original stored file
    - Excel sheet or CSV Sheet1
    - Canonical GridStock table
    - Canonical field to uploaded column mapping
    """

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    if dataset.get("type") != "uploaded":
        raise HTTPException(
            status_code=422,
            detail="Mappings can only be submitted for uploaded datasets.",
        )

    file_profiles = dataset.get(
        "profile", {}
    ).get("file_profiles", {})

    if not file_profiles:
        raise HTTPException(
            status_code=422,
            detail="Dataset has no inspected files.",
        )

    confirmed_mappings = []
    validation_errors = []

    seen_sources = set()
    seen_tables = set()

    for submitted in request.mappings:

        source_key = (
            submitted.file,
            submitted.sheet,
        )

        if source_key in seen_sources:
            validation_errors.append({
                "file": submitted.file,
                "sheet": submitted.sheet,
                "error": "Duplicate file and sheet mapping.",
            })
            continue

        seen_sources.add(source_key)

        table_key = submitted.table_name

        if table_key in seen_tables:
            validation_errors.append({
                "table": table_key,
                "error": (
                    "Multiple source sheets cannot currently "
                    "map to the same canonical table."
                ),
            })
            continue

        seen_tables.add(table_key)

        file_profile = file_profiles.get(submitted.file)

        if file_profile is None:
            validation_errors.append({
                "file": submitted.file,
                "error": "Uploaded file profile not found.",
            })
            continue

        sheet_profile = file_profile.get(
            "sheets", {}
        ).get(submitted.sheet)

        if sheet_profile is None:
            validation_errors.append({
                "file": submitted.file,
                "sheet": submitted.sheet,
                "error": "Uploaded sheet profile not found.",
            })
            continue

        uploaded_columns = [
            column["name"]
            for column in sheet_profile.get(
                "columns", []
            )
        ]

        try:
            validation = validate_table_mapping(
                submitted.table_name,
                uploaded_columns,
                submitted.mapping,
            )

        except ValueError as error:
            validation_errors.append({
                "file": submitted.file,
                "sheet": submitted.sheet,
                "error": str(error),
            })
            continue

        if not validation["valid"]:
            validation_errors.append({
                "file": submitted.file,
                "sheet": submitted.sheet,
                "table": submitted.table_name,
                "validation": validation,
            })
            continue

        confirmed_mappings.append({
            "file": submitted.file,
            "sheet": submitted.sheet,
            "table_name": submitted.table_name,
            "mapping": submitted.mapping,
            "status": "confirmed",
        })

    if validation_errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    "Some mappings are invalid. "
                    "Correct them before submitting again."
                ),
                "errors": validation_errors,
            },
        )

    if not confirmed_mappings:
        raise HTTPException(
            status_code=422,
            detail="No valid mappings were submitted.",
        )

    update_dataset(
        dataset_id,
        {
            "confirmed_mappings": confirmed_mappings,
            "mapping_status": "confirmed",
            "validation_report": None,
            "normalization_report": None,
            "normalization_status": "pending",
        },
    )

    return {
        "message": "Column mappings saved successfully.",
        "dataset_id": dataset_id,
        "confirmed_mappings": confirmed_mappings,
        "total_confirmed": len(confirmed_mappings),
        "next_step": "Run dataset validation.",
    }


# ============================================================
# DATASET VALIDATION
# ============================================================

@router.post("/datasets/{dataset_id}/validate")
def validate_uploaded_dataset(dataset_id: str):
    """
    Validate all confirmed mappings.

    This is structural validation only.
    It does not activate or normalize the dataset.
    """

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    confirmed_mappings = dataset.get(
        "confirmed_mappings", []
    )

    if not confirmed_mappings:
        raise HTTPException(
            status_code=422,
            detail=(
                "No confirmed mappings found. "
                "Submit column mappings first."
            ),
        )

    file_profiles = dataset.get(
        "profile", {}
    ).get("file_profiles", {})

    validation_results = []
    errors_found = []

    for confirmed in confirmed_mappings:

        file_profile = file_profiles.get(
            confirmed["file"]
        )

        if file_profile is None:
            errors_found.append({
                "file": confirmed["file"],
                "error": "Source file profile is missing.",
            })
            continue

        sheet_profile = file_profile.get(
            "sheets", {}
        ).get(confirmed["sheet"])

        if sheet_profile is None:
            errors_found.append({
                "file": confirmed["file"],
                "sheet": confirmed["sheet"],
                "error": "Source sheet profile is missing.",
            })
            continue

        uploaded_columns = [
            column["name"]
            for column in sheet_profile.get(
                "columns", []
            )
        ]

        try:
            result = validate_table_mapping(
                confirmed["table_name"],
                uploaded_columns,
                confirmed["mapping"],
            )

            validation_results.append({
                "file": confirmed["file"],
                "sheet": confirmed["sheet"],
                **result,
            })

            if not result["valid"]:
                errors_found.extend(result["errors"])

        except ValueError as error:
            errors_found.append({
                "file": confirmed["file"],
                "sheet": confirmed["sheet"],
                "error": str(error),
            })

    is_valid = (
        len(validation_results) == len(confirmed_mappings)
        and not errors_found
        and all(
            result["valid"]
            for result in validation_results
        )
    )

    report = {
        "dataset_id": dataset_id,
        "valid": is_valid,
        "total_mappings": len(confirmed_mappings),
        "validated_mappings": len(validation_results),
        "errors": errors_found,
        "results": validation_results,
        "normalization_ready": is_valid,
        "activation_allowed": False,
    }

    update_dataset(
        dataset_id,
        {
            "validation_report": report,
            "mapping_status": (
                "validated" if is_valid else "invalid"
            ),
            "status": "review",
        },
    )

    return {
        "message": (
            "Schema validation completed successfully."
            if is_valid
            else "Schema validation found issues."
        ),
        "report": report,
        "next_step": (
            "Dataset normalization is the next required stage."
            if is_valid
            else "Correct the mapping issues and validate again."
        ),
    }

