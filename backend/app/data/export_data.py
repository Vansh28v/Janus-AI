
import json
from pathlib import Path

import pandas as pd

from app.data.master_data import generate_master_data
from app.data.consumption import generate_consumption


def export_datasets():
    output_dir = Path("data")
    output_dir.mkdir(parents=True, exist_ok=True)

    master = generate_master_data()
    consumption = generate_consumption()

    datasets = {
        "materials": master["materials"],
        "locations": master["locations"],
        "suppliers": master["suppliers"],
        "consumption": consumption,
    }

    for name, records in datasets.items():
        df = pd.DataFrame(records)
        csv_path = output_dir / f"{name}.csv"
        df.to_csv(csv_path, index=False)
        print(f"Saved {name}: {len(df):,} records -> {csv_path}")

    metadata = {
        "project": "GridStock AI",
        "data_type": "SYNTHETIC",
        "random_seed": 42,
        "historical_weeks": 156,
        "materials": 20,
        "locations": 5,
        "suppliers": 8,
        "consumption_records": len(consumption),
    }

    with open(output_dir / "dataset_metadata.json", "w") as file:
        json.dump(metadata, file, indent=4)

    print("\nAll datasets exported successfully.")


if __name__ == "__main__":
    export_datasets()