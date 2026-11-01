
"""
GRIDSTOCK AI
Workspace Compatibility Access Controller

Controls access to system workspaces according to the
currently active dataset.

Synthetic datasets retain full demo access.
Uploaded datasets can only be used by explicitly approved
workspaces.
"""

from fastapi.responses import JSONResponse

from app.core.dataset_manager import get_active_dataset


# API route prefixes mapped to their workspace identifiers.
# More specific routes must appear before general routes.
WORKSPACE_ROUTE_PREFIXES = {
    "/api/inventory/optimization": "optimization",
    "/api/forecasts": "forecasting",
    "/api/inventory": "inventory",
    "/api/optimization": "optimization",
    "/api/suppliers": "suppliers",
    "/api/scenarios": "scenarios",
}


def get_workspace_for_path(path: str):
    """
    Determine which workspace owns an API request.
    """

    for prefix, workspace in WORKSPACE_ROUTE_PREFIXES.items():
        if path == prefix or path.startswith(prefix + "/"):
            return workspace

    return None


async def workspace_access_middleware(request, call_next):
    """
    Enforce active-dataset workspace permissions.

    Rules:
    - Synthetic dataset: unrestricted demo access.
    - Uploaded dataset: only explicitly approved workspaces
      with compatible quality reports are accessible.
    - Missing or invalid approval: deny access.
    """

    workspace = get_workspace_for_path(request.url.path)

    # Requests outside protected workspaces continue normally.
    if workspace is None:
        return await call_next(request)

    # Retrieve the currently active dataset.
    try:
        active_dataset = get_active_dataset()

    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "DATASET_LOOKUP_FAILED",
                "message": (
                    "The active dataset could not be retrieved. "
                    "Workspace access has been temporarily blocked."
                ),
                "workspace": workspace,
            },
        )

    # Do not allow protected workspace access without a dataset.
    if not active_dataset:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "NO_ACTIVE_DATASET",
                "message": (
                    "No active dataset is configured. "
                    "Activate a dataset before accessing this workspace."
                ),
                "workspace": workspace,
            },
        )

    dataset_type = active_dataset.get("type", "synthetic")

    # Preserve unrestricted access for the synthetic demo.
    if dataset_type == "synthetic":
        return await call_next(request)

    # Reject unsupported dataset types.
    if dataset_type != "uploaded":
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "error": "UNSUPPORTED_DATASET_TYPE",
                "message": (
                    "This dataset type is not supported "
                    "by the workspace access controller."
                ),
                "workspace": workspace,
            },
        )

    dataset_id = active_dataset.get("id")

    # Uploaded datasets must have completed explicit approval.
    if active_dataset.get("status") != "ready":
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "error": "DATASET_NOT_APPROVED",
                "message": (
                    "The active uploaded dataset has not been "
                    "approved. Complete normalization, quality "
                    "assessment and approval before using it."
                ),
                "workspace": workspace,
                "dataset_id": dataset_id,
            },
        )

    # Validate the approved workspace list.
    approved_workspaces = active_dataset.get(
        "approved_workspaces",
        [],
    )

    if not isinstance(approved_workspaces, list):
        approved_workspaces = []

    # Retrieve the saved quality and compatibility report.
    quality_report = active_dataset.get("quality_report") or {}

    if not isinstance(quality_report, dict):
        quality_report = {}

    compatibility = quality_report.get(
        "workspace_compatibility",
        {},
    )

    if not isinstance(compatibility, dict):
        compatibility = {}

    workspace_report = compatibility.get(workspace, {})

    if not isinstance(workspace_report, dict):
        workspace_report = {}

    # Require both explicit approval and a compatible quality report.
    workspace_approved = (
        workspace in approved_workspaces
        and workspace_report.get("compatible") is True
    )

    if not workspace_approved:
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "error": "WORKSPACE_NOT_COMPATIBLE",
                "message": (
                    f"The active dataset is not approved for "
                    f"the {workspace} workspace. Review the "
                    "dataset compatibility report or activate "
                    "a compatible dataset."
                ),
                "workspace": workspace,
                "dataset_id": dataset_id,
                "workspace_status": workspace_report.get(
                    "status",
                    "UNAVAILABLE",
                ),
                "missing_tables": workspace_report.get(
                    "missing_tables",
                    [],
                ),
                "missing_columns": workspace_report.get(
                    "missing_columns",
                    [],
                ),
            },
        )

    # Dataset is approved and compatible with this workspace.
    return await call_next(request)
