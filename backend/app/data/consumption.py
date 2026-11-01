
"""
GridStock AI - Historical Consumption Generator

Generates 36 months of weekly synthetic material consumption
for 20 materials across 5 utility locations.

All generated records are synthetic prototype data.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any

from app.data.master_data import generate_master_data


HISTORY_WEEKS = 156
RANDOM_SEED = 42


# Base weekly demand for each material.
# These are illustrative prototype assumptions, not GUVNL records.
BASE_WEEKLY_DEMAND = {
    "TR-DT-063": 1.5,
    "TR-DT-100": 1.0,
    "TR-DT-200": 0.5,
    "CB-XLPE-3C": 180,
    "CB-XLPE-1C": 250,
    "CN-ACSR-100": 300,
    "CN-ACSR-150": 180,
    "MT-1PH": 45,
    "MT-3PH": 20,
    "MT-CT": 5,
    "PL-8M": 12,
    "PL-9M": 8,
    "SW-VCB-11": 1,
    "SW-AB-11": 2,
    "SW-FUSE": 12,
    "IN-INSULATOR": 35,
    "IN-ROD": 8,
    "PR-CT": 4,
    "PR-PT": 3,
    "AC-GLAND": 15,
}


# Relative demand intensity at each location.
LOCATION_DEMAND_FACTORS = {
    "GUVNL-HO": 0.45,
    "GUVNL-ANAND": 0.90,
    "GUVNL-VAD": 1.15,
    "GUVNL-AHM": 1.30,
    "GUVNL-SRT": 1.20,
}


# Different materials respond differently to seasonal conditions.
SEASONAL_FACTORS = {
    "Transformer": 1.20,
    "Cable": 1.15,
    "Conductor": 1.15,
    "Meter": 1.05,
    "Pole": 1.20,
    "Switchgear": 1.10,
    "Insulator": 1.10,
    "Protection": 1.10,
    "Consumables": 1.05,
}


def get_seasonal_factor(week_number: int, category: str) -> float:
    """
    Apply a simple illustrative annual seasonal pattern.

    Higher demand is simulated during monsoon and pre-monsoon
    preparation periods.
    """

    week_in_year = week_number % 52

    if 20 <= week_in_year <= 36:
        return SEASONAL_FACTORS.get(category, 1.0)

    if 14 <= week_in_year <= 19:
        return 1.08

    return 0.95


def generate_consumption(
    seed: int = RANDOM_SEED,
    weeks: int = HISTORY_WEEKS,
) -> list[dict[str, Any]]:
    """Generate weekly material consumption records."""

    if weeks <= 0:
        raise ValueError("weeks must be greater than zero")

    rng = random.Random(seed)
    master_data = generate_master_data(seed=seed)

    materials = master_data["materials"]
    locations = master_data["locations"]

    # Anchor the history to the latest completed week.
    today = date.today()
    latest_week = today - timedelta(days=today.weekday() + 7)
    first_week = latest_week - timedelta(weeks=weeks - 1)

    records: list[dict[str, Any]] = []

    for material in materials:
        item_code = material["item_code"]
        category = material["category"]

        base_demand = BASE_WEEKLY_DEMAND[item_code]

        for location in locations:
            location_code = location["location_code"]
            location_factor = LOCATION_DEMAND_FACTORS[location_code]

            for week_index in range(weeks):
                week_start = first_week + timedelta(weeks=week_index)

                # Gradual demand growth over the historical period.
                growth_factor = 1 + (0.0015 * week_index)

                # Annual seasonality.
                seasonal_factor = get_seasonal_factor(
                    week_index,
                    category,
                )

                # Random variation around expected demand.
                random_factor = rng.uniform(0.75, 1.25)

                expected_demand = (
                    base_demand
                    * location_factor
                    * growth_factor
                    * seasonal_factor
                    * random_factor
                )

                # Occasional demand spikes.
                is_spike = rng.random() < 0.025

                if is_spike:
                    expected_demand *= rng.uniform(1.5, 2.5)

                # Integer materials cannot have fractional consumption.
                if material["unit"] in {"unit", "kit"}:
                    consumed_quantity = max(
                        0,
                        round(expected_demand),
                    )
                else:
                    consumed_quantity = round(
                        expected_demand,
                        2,
                    )

                records.append(
                    {
                        "week_start": week_start.isoformat(),
                        "item_code": item_code,
                        "location_code": location_code,
                        "quantity_consumed": consumed_quantity,
                        "unit": material["unit"],
                        "is_spike": is_spike,
                        "source": "SYNTHETIC",
                    }
                )

    return records


if __name__ == "__main__":
    consumption = generate_consumption()

    print("GRIDSTOCK AI - CONSUMPTION DATA GENERATOR")
    print("-" * 48)
    print(f"Total records: {len(consumption):,}")
    print(f"Materials: {len({r['item_code'] for r in consumption})}")
    print(f"Locations: {len({r['location_code'] for r in consumption})}")
    print(f"Historical weeks: {HISTORY_WEEKS}")
    print(
        "Date range:",
        consumption[0]["week_start"],
        "to",
        consumption[-1]["week_start"],
    )
    print(
        "Demand spikes:",
        sum(record["is_spike"] for record in consumption),
    )

    print("\nSample records:")

    for record in consumption[:5]:
        print(record)
