"""
GRIDSTOCK AI
Supplier Intelligence API
"""

from fastapi import APIRouter, HTTPException

from app.services.supplier_intelligence import (
    generate_supplier_intelligence,
)


router = APIRouter(
    prefix="/api/suppliers",
    tags=["Supplier Intelligence"],
)


@router.get("/overview")
def supplier_overview():
    """Return supplier performance and procurement analytics."""

    try:
        return generate_supplier_intelligence()

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
            detail=f"Supplier intelligence failed: {str(error)}",
        )