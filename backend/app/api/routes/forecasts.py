import numpy as np
import pandas as pd

from fastapi import APIRouter, HTTPException, Query

from app.core.dataset_manager import (
    get_dataset_file,
    get_generated_file,
    get_active_dataset,
)

from app.services.forecasting import (
    generate_forecasts_for_dataset,
)


router = APIRouter(
    prefix="/api/forecasts",
    tags=["Forecasting"],
)


# ---------------------------------------------------------
# ACTIVE DATASET HELPERS
# ---------------------------------------------------------

def get_current_dataset():

    dataset = get_active_dataset()

    if not dataset:
        raise HTTPException(
            status_code=503,
            detail="No active dataset is configured.",
        )

    return dataset


def get_dataset_id(dataset):

    return (
        dataset.get("dataset_id")
        or dataset.get("id")
    )


def get_dataset_information():

    dataset = get_current_dataset()

    return {
        "dataset_id": get_dataset_id(dataset),
        "dataset_name": dataset.get("name"),
        "dataset_type": dataset.get("type"),
    }


# ---------------------------------------------------------
# CSV LOADER
# ---------------------------------------------------------

def load_csv(
    filename: str,
    generated: bool = False,
    dataset_id: str | None = None,
) -> pd.DataFrame:

    try:

        file_path = (
            get_generated_file(
                filename,
                dataset_id=dataset_id,
            )
            if generated
            else get_dataset_file(
                filename,
                dataset_id=dataset_id,
            )
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if not file_path.exists():

        raise HTTPException(
            status_code=503,
            detail=(
                f"Required dataset file not found: {filename}. "
                "Please ensure the active dataset contains "
                "the required data."
            ),
        )

    try:

        return pd.read_csv(file_path)

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to read {filename}: {str(error)}",
        )


# ---------------------------------------------------------
# JSON-SAFE DATA CONVERSION
# ---------------------------------------------------------

def make_json_safe(df: pd.DataFrame) -> pd.DataFrame:

    """
    Replace NaN and infinite numeric values with None
    so FastAPI can serialize responses as valid JSON.
    """

    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    df = df.astype(object).where(
        pd.notna(df),
        None,
    )

    return df


# ---------------------------------------------------------
# GENERATE FORECASTS FOR ACTIVE UPLOADED DATASET
# ---------------------------------------------------------

@router.post("/generate")
def generate_active_dataset_forecasts():

    dataset = get_current_dataset()

    dataset_id = get_dataset_id(dataset)

    if dataset.get("type") != "uploaded":

        raise HTTPException(
            status_code=400,
            detail=(
                "Forecast generation through this endpoint "
                "is intended for uploaded datasets. "
                "The Synthetic Demo forecasting workflow "
                "remains available separately."
            ),
        )

    if not dataset_id:

        raise HTTPException(
            status_code=500,
            detail="Active dataset ID could not be resolved.",
        )

    try:

        result = generate_forecasts_for_dataset(
            dataset_id
        )

        return {
            "success": True,
            "message": "Forecasts generated successfully.",
            "dataset": {
                "dataset_id": dataset_id,
                "dataset_name": dataset.get("name"),
                "dataset_type": dataset.get("type"),
            },
            "forecast": result,
        }

    except ValueError as error:

        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Forecast generation failed: "
                f"{str(error)}"
            ),
        )


# ---------------------------------------------------------
# GET FORECASTS
# ---------------------------------------------------------

@router.get("")
def get_forecasts(
    item_code: str | None = None,
    location_code: str | None = None,
    limit: int = Query(
        default=500,
        ge=1,
        le=5000,
    ),
):

    df = load_csv(
        "forecasts.csv",
        generated=True,
    )

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    total_records = len(df)

    result_df = make_json_safe(
        df.head(limit).copy()
    )

    return {
        "total_records": total_records,
        "returned_records": len(result_df),

        "filters": {
            "item_code": item_code,
            "location_code": location_code,
        },

        "dataset": get_dataset_information(),

        "data": result_df.to_dict(
            orient="records"
        ),
    }


# ---------------------------------------------------------
# GET FORECAST SUMMARY
# ---------------------------------------------------------

@router.get("/summary")
def get_forecast_summary():

    df = load_csv(
        "forecast_summary.csv",
        generated=True,
    )

    if df.empty:

        raise HTTPException(
            status_code=404,
            detail="Forecast summary is empty.",
        )

    df = make_json_safe(df)

    result = df.iloc[0].to_dict()

    result["dataset"] = get_dataset_information()

    return result


# ---------------------------------------------------------
# GET FORECAST EVALUATION
# ---------------------------------------------------------

@router.get("/evaluation")
def get_forecast_evaluation(
    item_code: str | None = None,
    location_code: str | None = None,
):

    df = load_csv(
        "forecast_evaluation.csv",
        generated=True,
    )

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    total_series = len(df)

    df = make_json_safe(df)

    return {
        "total_series": total_series,

        "dataset": get_dataset_information(),

        "data": df.to_dict(
            orient="records"
        ),
    }


# ---------------------------------------------------------
# GET HISTORICAL CONSUMPTION
# ---------------------------------------------------------

@router.get("/history")
def get_historical_consumption(
    item_code: str | None = None,
    location_code: str | None = None,
    limit: int = Query(
        default=20000,
        ge=1,
        le=100000,
    ),
):

    df = load_csv("consumption.csv")

    if item_code:
        df = df[
            df["item_code"] == item_code
        ]

    if location_code:
        df = df[
            df["location_code"] == location_code
        ]

    df["week_start"] = pd.to_datetime(
        df["week_start"],
        errors="coerce",
    )

    df = df.dropna(
        subset=["week_start"]
    )

    df = df.sort_values("week_start")

    total_records = len(df)

    df = df.head(limit).copy()

    # Preserve compatibility with uploaded datasets
    # that do not contain optional metadata columns.

    optional_columns = [
        "is_spike",
        "source",
    ]

    for column in optional_columns:

        if column not in df.columns:
            df[column] = None

    required_columns = [
        "week_start",
        "item_code",
        "location_code",
        "quantity_consumed",
        "is_spike",
        "source",
    ]

    df = df[required_columns]

    df["week_start"] = (
        df["week_start"]
        .dt.strftime("%Y-%m-%d")
    )

    df = make_json_safe(df)

    records = df.to_dict(
        orient="records"
    )

    return {
        "total_records": total_records,
        "returned_records": len(records),

        "filters": {
            "item_code": item_code,
            "location_code": location_code,
        },

        "dataset": get_dataset_information(),

        "data": records,
    }