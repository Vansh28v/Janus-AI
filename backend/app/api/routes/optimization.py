"""
GRIDSTOCK AI
Inventory Optimization API

Exposes redistribution and procurement recommendations.
"""

from fastapi import APIRouter, HTTPException

from app.services.optimization import (
    generate_optimization_recommendations,
)


router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory Optimization"],
)


@router.get("/optimization")
def get_optimization_recommendations():
    """Return inventory optimization recommendations."""

    try:
        return generate_optimization_recommendations()

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
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
            detail=f"Optimization failed: {str(error)}",
        )