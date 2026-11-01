"""
GRIDSTOCK AI
Workspace Availability API

Provides the frontend with workspace access information
for the currently active dataset.
"""

from fastapi import APIRouter

from app.core.dataset_manager import get_active_dataset
from app.core.workspace_access import WORKSPACE_ROUTE_PREFIXES


router = APIRouter(
    prefix="/api/data-intelligence",
    tags=["Workspace Access"],
)


WORKSPACE_LABELS = {
    "forecasting": "Demand Forecasting",
    "inventory": "Inventory Intelligence",
    "optimization": "Inventory Optimization",
    "suppliers": "Supplier Intelligence",
    "scenarios": "Scenario Intelligence",
}


@router.get("/workspace-access")
def get_workspace_access():

    active_dataset = get_active_dataset()

    workspace_names = list(WORKSPACE_ROUTE_PREFIXES.values())

    # Preserve full access when no active dataset is configured.
    if not active_dataset:
        return {
            "success": True,
            "dataset": None,
            "dataset_mode": "SYNTHETIC",
            "workspaces": {
                workspace: {
                    "label": WORKSPACE_LABELS[workspace],
                    "status": "READY",
                    "compatible": True,
                    "allowed": True,
                    "reason": None,
                }
                for workspace in workspace_names
            },
        }

    dataset_type = active_dataset.get("type", "synthetic")

    # Synthetic demo: every workspace remains available.
    if dataset_type == "synthetic":
        return {
            "success": True,
            "dataset": {
                "id": active_dataset.get("id"),
                "name": active_dataset.get("name", "Synthetic Demo"),
                "type": dataset_type,
            },
            "dataset_mode": "SYNTHETIC",
            "workspaces": {
                workspace: {
                    "label": WORKSPACE_LABELS[workspace],
                    "status": "READY",
                    "compatible": True,
                    "allowed": True,
                    "reason": None,
                }
                for workspace in workspace_names
            },
        }

    quality_report = active_dataset.get("quality_report") or {}

    compatibility = quality_report.get(
        "workspace_compatibility",
        {},
    )

    approved_workspaces = active_dataset.get(
        "approved_workspaces",
        [],
    )

    dataset_ready = active_dataset.get("status") == "ready"

    workspace_results = {}

    for workspace in workspace_names:

        result = compatibility.get(workspace, {})

        compatible = result.get("compatible") is True

        allowed = (
            dataset_ready
            and compatible
            and workspace in approved_workspaces
        )

        if not dataset_ready:
            reason = "The uploaded dataset has not been approved."
        elif not compatible:
            reason = (
                "This dataset does not contain all the required "
                "data for this workspace."
            )
        elif workspace not in approved_workspaces:
            reason = "This workspace was not included in dataset approval."
        else:
            reason = None

        workspace_results[workspace] = {
            "label": WORKSPACE_LABELS[workspace],
            "status": "READY" if allowed else "UNAVAILABLE",
            "compatible": compatible,
            "allowed": allowed,
            "reason": reason,
            "missing_tables": result.get("missing_tables", []),
            "missing_columns": result.get("missing_columns", []),
        }

    return {
        "success": True,
        "dataset": {
            "id": active_dataset.get("id"),
            "name": active_dataset.get("name"),
            "type": dataset_type,
            "status": active_dataset.get("status"),
        },
        "dataset_mode": "UPLOADED",
        "workspaces": workspace_results,
    }