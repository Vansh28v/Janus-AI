"""
GRIDSTOCK AI
Dataset Lifecycle API

Handles:
- Active dataset workspace compatibility
- Dataset normalization
- Normalization reports
- Data quality assessment
- Quality reports
- Explicit dataset approval (with approved_workspaces persistence)
"""

from fastapi import APIRouter, HTTPException

from app.core.dataset_manager import (
    get_dataset,
)

from app.services.dataset_normalizer import (
    normalize_uploaded_dataset,
    get_normalization_report,
)

from app.services.dataset_quality import (
    run_dataset_quality_check,
    get_dataset_quality_report,
    approve_dataset,
    get_active_workspace_compatibility,
)


router = APIRouter(
    prefix="/api/data-intelligence",
    tags=["Dataset Lifecycle"],
)


def get_uploaded_dataset_or_404(dataset_id: str) -> dict:
    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset not found.",
        )

    if dataset.get("type") != "uploaded":
        raise HTTPException(
            status_code=422,
            detail="This operation is only available for uploaded datasets.",
        )

    return dataset


# ============================================================
# ACTIVE DATASET WORKSPACE COMPATIBILITY
# ============================================================

@router.get("/workspaces/active")
def get_active_workspace_compatibility_route():
    """
    Return workspace compatibility for the currently active dataset.
    Used by ActiveDataSource and scenario intelligence.
    """
    try:
        return get_active_workspace_compatibility()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to retrieve workspace compatibility: {str(error)}",
        )


# ============================================================
# DATASET NORMALIZATION
# ============================================================

@router.post("/datasets/{dataset_id}/normalize")
def normalize_dataset_route(dataset_id: str):
    """
    Normalize all confirmed and structurally validated mappings.
    Publishes canonical CSVs into backend/uploads/<dataset_id>/normalized/.
    """
    dataset = get_uploaded_dataset_or_404(dataset_id)

    validation_report = dataset.get("validation_report", {})

    if not validation_report.get("valid"):
        raise HTTPException(
            status_code=422,
            detail="Dataset must pass structural validation before normalization.",
        )

    try:
        report = normalize_uploaded_dataset(dataset_id)

        if not report.get("valid", False):
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Dataset normalization failed.",
                    "report": report,
                },
            )

        updated_dataset = get_dataset(dataset_id)

        return {
            "message": "Dataset normalization completed successfully.",
            "dataset_id": dataset_id,
            "report": report,
            "normalization": report,
            "dataset": updated_dataset,
            "normalization_status": (
                updated_dataset.get("normalization_status")
                if updated_dataset else None
            ),
            "next_step": "Run dataset-level quality checks and workspace compatibility validation.",
        }

    except HTTPException:
        raise

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset normalization failed: {str(error)}",
        )


# ============================================================
# NORMALIZATION REPORTS
# ============================================================

@router.get("/datasets/{dataset_id}/normalization")
@router.get("/datasets/{dataset_id}/normalization-report")
def get_normalization_report_route(dataset_id: str):
    """
    Retrieve the saved normalization report for an uploaded dataset.
    Supports both /normalization and /normalization-report URL paths.
    """
    get_uploaded_dataset_or_404(dataset_id)

    try:
        report = get_normalization_report(dataset_id)

        if not report:
            raise HTTPException(
                status_code=404,
                detail="Normalization report is not available.",
            )

        return {
            "dataset_id": dataset_id,
            "normalization_report": report,
            "report": report,
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to retrieve normalization report: {str(error)}",
        )


# ============================================================
# DATA QUALITY ASSESSMENT
# ============================================================

@router.post("/datasets/{dataset_id}/quality-check")
def run_quality_check_route(dataset_id: str):
    """
    Run data quality assessment and workspace compatibility check.
    Requires dataset normalization to be completed first.
    """
    get_uploaded_dataset_or_404(dataset_id)

    try:
        return run_dataset_quality_check(dataset_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Quality check failed: {str(exc)}",
        )


# ============================================================
# QUALITY REPORT RETRIEVAL
# ============================================================

@router.get("/datasets/{dataset_id}/quality-report")
def get_quality_report_route(dataset_id: str):
    """
    Retrieve the latest quality and workspace compatibility report.
    """
    get_uploaded_dataset_or_404(dataset_id)

    try:
        report = get_dataset_quality_report(dataset_id)

        if report.get("quality_status") == "pending":
            raise HTTPException(
                status_code=404,
                detail=report.get("message", "Quality report pending."),
            )

        return report

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not retrieve quality report: {str(exc)}",
        )


# ============================================================
# DATASET APPROVAL
# ============================================================

@router.post("/datasets/{dataset_id}/approve")
def approve_dataset_route(dataset_id: str):
    """
    Explicitly approve an eligible quality-checked dataset for activation.
    Persists approved_workspaces so compatible workspaces are unlocked.
    """
    get_uploaded_dataset_or_404(dataset_id)

    try:
        return approve_dataset(dataset_id)

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset approval failed: {str(exc)}",
        )
