from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.scenario_intelligence import (
    get_scenario_options,
    simulate_scenario,
)


router = APIRouter(
    prefix="/api/scenarios",
    tags=["Scenario Intelligence"],
)


# ============================================================
# REQUEST SCHEMA
# ============================================================

class ScenarioSimulationRequest(BaseModel):
    scenario_type: str = Field(
        ...,
        description="Scenario type to simulate.",
    )

    demand_increase_pct: float = Field(
        default=25,
        ge=0,
        le=300,
    )

    delay_days: int = Field(
        default=10,
        ge=0,
        le=180,
    )

    item_code: str | None = None
    location_code: str | None = None

    additional_demand: float = Field(
        default=0,
        ge=0,
    )

    event_week: str | None = None

    budget_reduction_pct: float = Field(
        default=20,
        ge=0,
        le=100,
    )

    supplier_code: str | None = None


# ============================================================
# GET SCENARIO OPTIONS
# ============================================================

@router.get("/options")
def scenario_options():
    try:
        return get_scenario_options()

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to load scenario options: {str(exc)}",
        ) from exc


# ============================================================
# POST SCENARIO SIMULATION
# ============================================================

@router.post("/simulate")
def run_scenario(
    request: ScenarioSimulationRequest,
):
    try:
        payload: dict[str, Any] = request.model_dump(
            exclude_none=True
        )

        result = simulate_scenario(payload)

        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scenario simulation failed: {str(exc)}",
        ) from exc