import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.core.dataset_manager import (
    get_active_dataset,
    get_dataset,
    get_dataset_file,
    get_generated_file,
)


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

TEST_WEEKS = 26
FORECAST_HORIZON = 12
SEASONAL_PERIOD = 52

CROSTON_ALPHA = 0.10

ADI_THRESHOLD = 1.32
CV2_THRESHOLD = 0.49

MIN_HISTORY_WEEKS = 4


# ---------------------------------------------------------
# DATASET RESOLUTION
# ---------------------------------------------------------

def resolve_dataset(dataset_id=None):
    """
    Resolve either an explicitly selected dataset or
    the currently active dataset.
    """

    if dataset_id:
        dataset = get_dataset(dataset_id)

        if not dataset:
            raise ValueError(
                f"Dataset '{dataset_id}' was not found."
            )

        return dataset

    dataset = get_active_dataset()

    if not dataset:
        raise ValueError("No active dataset is configured.")

    return dataset


# ---------------------------------------------------------
# DATA LOADING
# ---------------------------------------------------------

def load_consumption_data(dataset_id=None):

    data_path = get_dataset_file(
        "consumption.csv",
        dataset_id=dataset_id
    )

    if not data_path.exists():
        raise FileNotFoundError(
            f"Consumption dataset not found: {data_path}"
        )

    df = pd.read_csv(data_path)

    required_columns = {
        "week_start",
        "item_code",
        "location_code",
        "quantity_consumed",
    }

    missing = required_columns - set(df.columns)

    if missing:
        raise ValueError(
            f"Dataset is missing columns: {sorted(missing)}"
        )

    df["week_start"] = pd.to_datetime(
        df["week_start"],
        errors="coerce"
    )

    df["item_code"] = df["item_code"].astype(str).str.strip()
    df["location_code"] = (
        df["location_code"].astype(str).str.strip()
    )

    df["quantity_consumed"] = pd.to_numeric(
        df["quantity_consumed"],
        errors="coerce"
    )

    if df["week_start"].isna().any():
        raise ValueError(
            "Consumption data contains invalid week_start dates."
        )

    if df["quantity_consumed"].isna().any():
        raise ValueError(
            "Demand data contains missing or invalid quantities."
        )

    if (df["quantity_consumed"] < 0).any():
        raise ValueError(
            "Demand quantities cannot be negative."
        )

    if (
        df["item_code"].eq("").any()
        or df["location_code"].eq("").any()
    ):
        raise ValueError(
            "Item codes and location codes cannot be empty."
        )

    duplicate_keys = df.duplicated(
        subset=[
            "week_start",
            "item_code",
            "location_code",
        ]
    )

    if duplicate_keys.any():
        raise ValueError(
            f"Found {duplicate_keys.sum()} duplicate "
            "item-location-week records."
        )

    if df.empty:
        raise ValueError("Consumption dataset is empty.")

    return df.sort_values(
        ["item_code", "location_code", "week_start"]
    ).reset_index(drop=True)


# ---------------------------------------------------------
# DEMAND CLASSIFICATION: ADI AND CV²
# ---------------------------------------------------------

def classify_demand(values):

    values = np.asarray(values, dtype=float)

    non_zero = values[values > 0]

    if len(non_zero) == 0:
        return {
            "adi": None,
            "cv2": 0.0,
            "classification": "no_demand",
        }

    adi = len(values) / len(non_zero)

    mean_demand = np.mean(non_zero)

    if mean_demand == 0:
        cv2 = 0.0
    else:
        cv2 = (
            np.var(non_zero, ddof=1) / (mean_demand ** 2)
            if len(non_zero) > 1
            else 0.0
        )

    if adi < ADI_THRESHOLD:

        if cv2 < CV2_THRESHOLD:
            category = "smooth"
        else:
            category = "erratic"

    else:

        if cv2 < CV2_THRESHOLD:
            category = "intermittent"
        else:
            category = "lumpy"

    return {
        "adi": float(adi),
        "cv2": float(cv2),
        "classification": category,
    }


# ---------------------------------------------------------
# MODEL 1: SEASONAL NAIVE
# ---------------------------------------------------------

def seasonal_naive(train, horizon):

    train = np.asarray(train, dtype=float)

    if len(train) == 0:
        return np.zeros(horizon)

    if len(train) >= SEASONAL_PERIOD:
        pattern = train[-SEASONAL_PERIOD:]
    else:
        pattern = train

    predictions = np.resize(pattern, horizon)

    return np.maximum(predictions, 0)


# ---------------------------------------------------------
# MODEL 2: CROSTON
# ---------------------------------------------------------

def croston_forecast(
    train,
    horizon,
    alpha=CROSTON_ALPHA
):

    train = np.asarray(train, dtype=float)

    nonzero_indices = np.flatnonzero(train > 0)

    if len(nonzero_indices) == 0:
        return np.zeros(horizon)

    first_index = nonzero_indices[0]

    demand_size = train[first_index]
    demand_interval = first_index + 1

    interval = 1

    for value in train[first_index + 1:]:

        if value > 0:

            demand_size += alpha * (
                value - demand_size
            )

            demand_interval += alpha * (
                interval - demand_interval
            )

            interval = 1

        else:
            interval += 1

    if demand_interval <= 0:
        estimate = 0.0
    else:
        estimate = demand_size / demand_interval

    return np.full(
        horizon,
        max(float(estimate), 0.0)
    )


# ---------------------------------------------------------
# MODEL 3: SBA
# ---------------------------------------------------------

def sba_forecast(
    train,
    horizon,
    alpha=CROSTON_ALPHA
):

    predictions = croston_forecast(
        train,
        horizon,
        alpha
    )

    correction = 1 - (alpha / 2)

    return np.maximum(
        predictions * correction,
        0
    )


# ---------------------------------------------------------
# MODEL 4: EXPONENTIAL SMOOTHING
# ---------------------------------------------------------

def ets_forecast(train, horizon):

    train = np.asarray(train, dtype=float)

    if len(train) == 0:
        return np.zeros(horizon)

    if len(train) < 3 or np.all(train == train[0]):

        return np.full(
            horizon,
            max(float(np.mean(train)), 0.0)
        )

    try:

        with warnings.catch_warnings():

            warnings.simplefilter("ignore")

            model = ExponentialSmoothing(
                train,
                trend="add",
                damped_trend=True,
                seasonal=None,
                initialization_method="estimated",
            )

            fitted = model.fit(optimized=True)

            predictions = fitted.forecast(horizon)

        return np.maximum(
            np.asarray(predictions, dtype=float),
            0
        )

    except Exception:

        return np.full(
            horizon,
            max(float(np.mean(train)), 0.0)
        )


# ---------------------------------------------------------
# MODEL EVALUATION METRICS
# ---------------------------------------------------------

def calculate_metrics(actual, predicted):

    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    errors = predicted - actual

    mae = np.mean(np.abs(errors))
    rmse = np.sqrt(np.mean(errors ** 2))

    total_actual = np.sum(actual)

    if total_actual > 0:

        wape = (
            np.sum(np.abs(errors)) / total_actual
        ) * 100

        bias = (
            np.sum(errors) / total_actual
        ) * 100

    else:
        wape = np.nan
        bias = np.nan

    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "wape": float(wape) if np.isfinite(wape) else None,
        "bias": float(bias) if np.isfinite(bias) else None,
    }


# ---------------------------------------------------------
# MODEL CANDIDATES
# ---------------------------------------------------------

def get_candidate_models(classification):

    if classification in ("smooth", "erratic"):

        return {
            "seasonal_naive": seasonal_naive,
            "ets": ets_forecast,
        }

    if classification in ("intermittent", "lumpy"):

        return {
            "seasonal_naive": seasonal_naive,
            "croston": croston_forecast,
            "sba": sba_forecast,
        }

    return {
        "seasonal_naive": seasonal_naive,
    }


# ---------------------------------------------------------
# MODEL SELECTION
# ---------------------------------------------------------

def select_best_model(train, test, classification):

    candidates = get_candidate_models(classification)

    results = []

    for model_name, model_function in candidates.items():

        try:

            predictions = model_function(
                train,
                len(test)
            )

            metrics = calculate_metrics(
                test,
                predictions
            )

            # WAPE is primary when actual demand exists.
            # MAE is used when the test period has zero demand.

            score = metrics["wape"]

            if score is None or not np.isfinite(score):
                score = metrics["mae"]

            results.append({
                "model": model_name,
                "score": float(score),
                "metrics": metrics,
            })

        except Exception as error:

            print(
                f"Warning: {model_name} failed: {error}"
            )

    if not results:

        raise RuntimeError(
            "All candidate forecasting models failed."
        )

    results.sort(
        key=lambda result: result["score"]
    )

    return results[0], results

# ---------------------------------------------------------
# MAIN FORECASTING ENGINE
# ---------------------------------------------------------

def run_forecasting(dataset_id=None):

    print("\n" + "=" * 60)
    print("GRIDSTOCK AI - FORECASTING ENGINE")
    print("=" * 60)

    dataset = resolve_dataset(dataset_id)

    resolved_dataset_id = dataset.get("dataset_id") or dataset.get("id")

    dataset_name = dataset.get(
        "name",
        "Unknown Dataset"
    )

    dataset_type = dataset.get(
        "type",
        "synthetic"
    )

    forecast_source = (
        "SYNTHETIC_MODEL_FORECAST"
        if dataset_type == "synthetic"
        else "UPLOADED_MODEL_FORECAST"
    )

    print(f"\nDataset: {dataset_name}")
    print(f"Dataset type: {dataset_type}")

    df = load_consumption_data(
        dataset_id=resolved_dataset_id
    )

    print(f"\nDataset loaded: {len(df):,} records")

    all_dates = pd.date_range(
        start=df["week_start"].min(),
        end=df["week_start"].max(),
        freq="7D",
    )

    if len(all_dates) < MIN_HISTORY_WEEKS:
        raise ValueError(
            f"At least {MIN_HISTORY_WEEKS} weekly periods "
            "are required for forecasting."
        )

    evaluation_results = []
    forecast_results = []

    grouped = df.groupby(
        ["item_code", "location_code"],
        sort=True
    )

    print(
        f"Item-location combinations: {len(grouped)}"
    )

    print(
        f"Available weekly periods: {len(all_dates)}"
    )

    skipped_series = 0

    for (item_code, location_code), group in grouped:

        series = (
            group.set_index("week_start")["quantity_consumed"]
            .reindex(all_dates, fill_value=0)
            .astype(float)
        )

        values = series.to_numpy()

        if len(values) < MIN_HISTORY_WEEKS:

            skipped_series += 1

            print(
                f"Skipping {item_code} / {location_code}: "
                "insufficient history."
            )

            continue

        # Adaptive holdout:
        # Use up to 26 weeks, but retain at least
        # approximately 75% of history for training.

        test_weeks = min(
            TEST_WEEKS,
            max(1, len(values) // 4)
        )

        train = values[:-test_weeks]
        test = values[-test_weeks:]

        if len(train) < 3:
            skipped_series += 1
            continue

        demand_profile = classify_demand(train)

        best_result, all_results = select_best_model(
            train,
            test,
            demand_profile["classification"]
        )

        best_model_name = best_result["model"]

        model_functions = {
            "seasonal_naive": seasonal_naive,
            "croston": croston_forecast,
            "sba": sba_forecast,
            "ets": ets_forecast,
        }

        selected_model = model_functions[best_model_name]

        # Refit selected model using all available history.

        future_predictions = selected_model(
            values,
            FORECAST_HORIZON
        )

        metrics = best_result["metrics"]

        evaluation_results.append({
            "item_code": item_code,
            "location_code": location_code,
            "classification": demand_profile["classification"],
            "adi": demand_profile["adi"],
            "cv2": demand_profile["cv2"],
            "selected_model": best_model_name,
            "mae": metrics["mae"],
            "rmse": metrics["rmse"],
            "wape": metrics["wape"],
            "bias": metrics["bias"],
            "training_weeks": len(train),
            "test_weeks": len(test),
        })

        future_dates = pd.date_range(
            start=all_dates[-1] + pd.Timedelta(days=7),
            periods=FORECAST_HORIZON,
            freq="7D",
        )

        for forecast_date, prediction in zip(
            future_dates,
            future_predictions
        ):

            forecast_results.append({
                "week_start": forecast_date.date(),
                "item_code": item_code,
                "location_code": location_code,
                "forecast_quantity": round(
                    max(float(prediction), 0),
                    3
                ),
                "selected_model": best_model_name,
                "classification": demand_profile["classification"],
                "source": forecast_source,
            })

    evaluation_df = pd.DataFrame(evaluation_results)

    forecasts_df = pd.DataFrame(forecast_results)

    # -----------------------------------------------------
    # OUTPUT PATHS
    # -----------------------------------------------------

    evaluation_path = get_generated_file(
        "forecast_evaluation.csv",
        dataset_id=resolved_dataset_id
    )

    forecasts_path = get_generated_file(
        "forecasts.csv",
        dataset_id=resolved_dataset_id
    )

    summary_path = get_generated_file(
        "forecast_summary.csv",
        dataset_id=resolved_dataset_id
    )

    evaluation_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    forecasts_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    summary_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    evaluation_df.to_csv(
        evaluation_path,
        index=False
    )

    forecasts_df.to_csv(
        forecasts_path,
        index=False
    )

    # -----------------------------------------------------
    # OVERALL SUMMARY
    # -----------------------------------------------------

    if not evaluation_df.empty:

        summary = {
            "total_series": len(evaluation_df),
            "total_forecasts": len(forecasts_df),
            "skipped_series": skipped_series,
            "forecast_horizon_weeks": FORECAST_HORIZON,
            "test_period_weeks": TEST_WEEKS,
            "mean_mae": float(evaluation_df["mae"].mean()),
            "mean_rmse": float(evaluation_df["rmse"].mean()),
            "mean_wape": (
                float(evaluation_df["wape"].mean())
                if evaluation_df["wape"].notna().any()
                else None
            ),
            "mean_bias": (
                float(evaluation_df["bias"].mean())
                if evaluation_df["bias"].notna().any()
                else None
            ),
            "source": forecast_source,
        }

    else:

        summary = {
            "total_series": 0,
            "total_forecasts": 0,
            "skipped_series": skipped_series,
            "forecast_horizon_weeks": FORECAST_HORIZON,
            "test_period_weeks": TEST_WEEKS,
            "mean_mae": None,
            "mean_rmse": None,
            "mean_wape": None,
            "mean_bias": None,
            "source": forecast_source,
        }

    pd.DataFrame([summary]).to_csv(
        summary_path,
        index=False
    )

    # -----------------------------------------------------
    # REPORT
    # -----------------------------------------------------

    print("\n" + "-" * 60)
    print("FORECASTING COMPLETED")
    print("-" * 60)

    print(f"Dataset: {dataset_name}")
    print(f"Evaluated series: {summary['total_series']}")
    print(f"Generated forecasts: {summary['total_forecasts']}")
    print(f"Skipped series: {skipped_series}")

    if not evaluation_df.empty:

        print("\nSelected model distribution:")

        print(
            evaluation_df["selected_model"]
            .value_counts()
            .to_string()
        )

        print("\nDemand classification distribution:")

        print(
            evaluation_df["classification"]
            .value_counts()
            .to_string()
        )

        print("\nAverage evaluation metrics:")

        print(f"MAE:  {summary['mean_mae']:.3f}")
        print(f"RMSE: {summary['mean_rmse']:.3f}")

        if summary["mean_wape"] is not None:
            print(f"WAPE: {summary['mean_wape']:.2f}%")

        if summary["mean_bias"] is not None:
            print(f"Bias: {summary['mean_bias']:.2f}%")

    print("\nGenerated files:")
    print(f"1. {evaluation_path}")
    print(f"2. {forecasts_path}")
    print(f"3. {summary_path}")

    print(f"\nForecast source: {forecast_source}")
    print("=" * 60)

    return {
        "dataset_id": resolved_dataset_id,
        "dataset_name": dataset_name,
        "dataset_type": dataset_type,
        "summary": summary,
        "files": {
            "forecast_evaluation": str(evaluation_path),
            "forecasts": str(forecasts_path),
            "forecast_summary": str(summary_path),
        },
    }


# ---------------------------------------------------------
# UPLOADED DATASET FORECASTING ENTRY POINT
# ---------------------------------------------------------

def generate_forecasts_for_dataset(dataset_id):

    dataset = get_dataset(dataset_id)

    if not dataset:
        raise ValueError(
            f"Dataset '{dataset_id}' was not found."
        )

    if dataset.get("type") != "uploaded":
        raise ValueError(
            "This operation is intended for uploaded datasets."
        )

    if dataset.get("status") != "ready":
        raise ValueError(
            "Dataset must be approved before forecasting."
        )

    if dataset.get("normalization_status") != "completed":
        raise ValueError(
            "Dataset normalization must be completed first."
        )

    approved_workspaces = dataset.get(
        "approved_workspaces",
        []
    )

    if "forecasting" not in approved_workspaces:
        raise ValueError(
            "This dataset has not been approved for forecasting."
        )

    return run_forecasting(
        dataset_id=dataset_id
    )


# ---------------------------------------------------------
# SCRIPT ENTRY POINT
# ---------------------------------------------------------

if __name__ == "__main__":
    run_forecasting()