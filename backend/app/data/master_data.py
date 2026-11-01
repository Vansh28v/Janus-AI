
"""
GridStock AI - Master Data Generator

Generates reproducible master data for:
- Electrical materials
- Utility locations
- Suppliers
"""

from __future__ import annotations

import random
from typing import Any


def generate_master_data(seed: int = 42) -> dict[str, list[dict[str, Any]]]:
    """Generate the master records used by GridStock AI."""

    rng = random.Random(seed)

    materials = [
        {
            "item_code": "TR-DT-063",
            "item_name": "Distribution Transformer 63 kVA",
            "category": "Transformer",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 145000,
            "lead_time_days": 45,
        },
        {
            "item_code": "TR-DT-100",
            "item_name": "Distribution Transformer 100 kVA",
            "category": "Transformer",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 185000,
            "lead_time_days": 50,
        },
        {
            "item_code": "TR-DT-200",
            "item_name": "Distribution Transformer 200 kVA",
            "category": "Transformer",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 265000,
            "lead_time_days": 60,
        },
        {
            "item_code": "CB-XLPE-3C",
            "item_name": "XLPE Cable 3 Core",
            "category": "Cable",
            "unit": "meter",
            "criticality": "Vital",
            "unit_cost": 420,
            "lead_time_days": 25,
        },
        {
            "item_code": "CB-XLPE-1C",
            "item_name": "XLPE Cable Single Core",
            "category": "Cable",
            "unit": "meter",
            "criticality": "Essential",
            "unit_cost": 180,
            "lead_time_days": 20,
        },
        {
            "item_code": "CN-ACSR-100",
            "item_name": "ACSR Conductor 100 sq mm",
            "category": "Conductor",
            "unit": "meter",
            "criticality": "Vital",
            "unit_cost": 95,
            "lead_time_days": 30,
        },
        {
            "item_code": "CN-ACSR-150",
            "item_name": "ACSR Conductor 150 sq mm",
            "category": "Conductor",
            "unit": "meter",
            "criticality": "Essential",
            "unit_cost": 135,
            "lead_time_days": 30,
        },
        {
            "item_code": "MT-1PH",
            "item_name": "Single Phase Energy Meter",
            "category": "Meter",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 850,
            "lead_time_days": 20,
        },
        {
            "item_code": "MT-3PH",
            "item_name": "Three Phase Energy Meter",
            "category": "Meter",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 2200,
            "lead_time_days": 25,
        },
        {
            "item_code": "MT-CT",
            "item_name": "CT Operated Energy Meter",
            "category": "Meter",
            "unit": "unit",
            "criticality": "Desirable",
            "unit_cost": 6500,
            "lead_time_days": 35,
        },
        {
            "item_code": "PL-8M",
            "item_name": "Concrete Electric Pole 8m",
            "category": "Pole",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 8500,
            "lead_time_days": 35,
        },
        {
            "item_code": "PL-9M",
            "item_name": "Concrete Electric Pole 9m",
            "category": "Pole",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 10500,
            "lead_time_days": 40,
        },
        {
            "item_code": "SW-VCB-11",
            "item_name": "11kV Vacuum Circuit Breaker",
            "category": "Switchgear",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 125000,
            "lead_time_days": 55,
        },
        {
            "item_code": "SW-AB-11",
            "item_name": "11kV Air Break Switch",
            "category": "Switchgear",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 38000,
            "lead_time_days": 40,
        },
        {
            "item_code": "SW-FUSE",
            "item_name": "Distribution Fuse Unit",
            "category": "Switchgear",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 1800,
            "lead_time_days": 15,
        },
        {
            "item_code": "IN-INSULATOR",
            "item_name": "Porcelain Insulator",
            "category": "Insulator",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 450,
            "lead_time_days": 15,
        },
        {
            "item_code": "IN-ROD",
            "item_name": "Lightning Arrestor",
            "category": "Protection",
            "unit": "unit",
            "criticality": "Vital",
            "unit_cost": 3200,
            "lead_time_days": 25,
        },
        {
            "item_code": "PR-CT",
            "item_name": "Current Transformer",
            "category": "Protection",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 7800,
            "lead_time_days": 30,
        },
        {
            "item_code": "PR-PT",
            "item_name": "Potential Transformer",
            "category": "Protection",
            "unit": "unit",
            "criticality": "Essential",
            "unit_cost": 12000,
            "lead_time_days": 35,
        },
        {
            "item_code": "AC-GLAND",
            "item_name": "Cable Gland and Accessories Kit",
            "category": "Consumables",
            "unit": "kit",
            "criticality": "Desirable",
            "unit_cost": 950,
            "lead_time_days": 12,
        },
    ]

    locations = [
        {
            "location_code": "GUVNL-HO",
            "location_name": "Head Store",
            "region": "Central Gujarat",
            "location_type": "Head Store",
            "latitude": 22.3072,
            "longitude": 73.1812,
        },
        {
            "location_code": "GUVNL-ANAND",
            "location_name": "Anand Circle Store",
            "region": "Central Gujarat",
            "location_type": "Circle Store",
            "latitude": 22.5645,
            "longitude": 72.9289,
        },
        {
            "location_code": "GUVNL-VAD",
            "location_name": "Vadodara Circle Store",
            "region": "Central Gujarat",
            "location_type": "Circle Store",
            "latitude": 22.3072,
            "longitude": 73.1812,
        },
        {
            "location_code": "GUVNL-AHM",
            "location_name": "Ahmedabad Circle Store",
            "region": "North Gujarat",
            "location_type": "Circle Store",
            "latitude": 23.0225,
            "longitude": 72.5714,
        },
        {
            "location_code": "GUVNL-SRT",
            "location_name": "Surat Circle Store",
            "region": "South Gujarat",
            "location_type": "Circle Store",
            "latitude": 21.1702,
            "longitude": 72.8311,
        },
    ]

    supplier_names = [
        "Gujarat Electrical Supplies",
        "Western Power Equipment",
        "National Transformer Works",
        "Prime Cable Industries",
        "ElectroTech Components",
        "Bharat Switchgear Corporation",
        "Reliable Energy Materials",
        "Universal Grid Solutions",
    ]

    suppliers = []

    for index, name in enumerate(supplier_names, start=1):
        suppliers.append(
            {
                "supplier_code": f"SUP-{index:03d}",
                "supplier_name": name,
                "average_lead_time_days": rng.randint(15, 60),
                "lead_time_std_days": rng.randint(2, 10),
                "reliability_score": round(rng.uniform(0.75, 0.99), 2),
                "status": "Active",
            }
        )

    return {
        "materials": materials,
        "locations": locations,
        "suppliers": suppliers,
    }


if __name__ == "__main__":
    data = generate_master_data()

    for category, records in data.items():
        print(f"\n{category.upper()}: {len(records)} records")

        for record in records[:3]:
            print(record)
