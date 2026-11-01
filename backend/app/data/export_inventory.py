
"""
GRIDSTOCK AI
Inventory Data Exporter

Exports the existing deterministic inventory simulation
into CSV files for backend API and dashboard consumption.

Does not modify inventory simulation logic.
"""

import csv
import sys
from pathlib import Path

# Resolve backend directory and make app imports available.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_DIR = BACKEND_ROOT / "data"

sys.path.insert(0, str(BACKEND_ROOT))

from app.data.inventory import generate_inventory



def export_csv(filename, records):
    """Export a list of dictionaries to a CSV file."""

    if not records:
        print(f"Skipped {filename}: no records found.")
        return

    output_path = DATA_DIR / filename

    # Collect every unique field across all records.
    fieldnames = list(
        dict.fromkeys(
            key
            for record in records
            for key in record.keys()
        )
    )

    with output_path.open(
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as csvfile:

        writer = csv.DictWriter(
            csvfile,
            fieldnames=fieldnames,
            extrasaction="raise",
        )

        writer.writeheader()
        writer.writerows(records)

    print(
        f"Exported {filename}: "
        f"{len(records):,} records"
    )



def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 55)
    print("GRIDSTOCK AI - INVENTORY DATA EXPORT")
    print("=" * 55)

    print("\nGenerating deterministic inventory dataset...")

    inventory = generate_inventory()

    print("\nExporting datasets...\n")

    export_csv(
        "opening_balances.csv",
        inventory["opening_balances"],
    )

    export_csv(
        "stock_movements.csv",
        inventory["movements"],
    )

    export_csv(
        "weekly_inventory.csv",
        inventory["weekly_inventory"],
    )

    export_csv(
        "purchase_orders.csv",
        inventory["purchase_orders"],
    )

    print("\n" + "=" * 55)
    print("INVENTORY DATA EXPORT COMPLETED")
    print("=" * 55)

    print(f"\nOutput directory: {DATA_DIR}")


if __name__ == "__main__":
    main()
