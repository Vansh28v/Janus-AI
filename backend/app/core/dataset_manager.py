import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

BACKEND_ROOT = Path(__file__).resolve().parents[2]

SYNTHETIC_DATA_DIR = BACKEND_ROOT / "data"
UPLOADS_DIR = BACKEND_ROOT / "uploads"

REGISTRY_FILE = UPLOADS_DIR / "registry.json"
ACTIVE_DATASET_FILE = UPLOADS_DIR / "active_dataset.json"


# ---------------------------------------------------------
# INITIALIZATION
# ---------------------------------------------------------

def initialize_dataset_storage() -> None:
    """Create dataset storage and initialize registry files."""

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    if not REGISTRY_FILE.exists():
        registry = {
            "datasets": [
                {
                    "id": "synthetic_demo",
                    "name": "Synthetic Demo",
                    "type": "synthetic",
                    "description": "Built-in GridStock AI demonstration dataset.",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "status": "ready",
                }
            ]
        }

        save_json(REGISTRY_FILE, registry)

    if not ACTIVE_DATASET_FILE.exists():
        save_json(
            ACTIVE_DATASET_FILE,
            {"active_dataset_id": "synthetic_demo"}
        )


# ---------------------------------------------------------
# JSON UTILITIES
# ---------------------------------------------------------

def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = path.with_suffix(".tmp")

    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)

    temporary_path.replace(path)


def load_json(path: Path, default: dict | None = None) -> dict:
    if not path.exists():
        return default or {}

    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError):
        return default or {}


# ---------------------------------------------------------
# DATASET REGISTRY
# ---------------------------------------------------------

def get_dataset_registry() -> dict:
    initialize_dataset_storage()
    return load_json(REGISTRY_FILE, {"datasets": []})


def list_datasets() -> list[dict]:
    registry = get_dataset_registry()
    return registry.get("datasets", [])


def get_dataset(dataset_id: str) -> dict | None:
    for dataset in list_datasets():
        if dataset.get("id") == dataset_id:
            return dataset

    return None


# ---------------------------------------------------------
# ACTIVE DATASET
# ---------------------------------------------------------

def get_active_dataset_id() -> str:
    initialize_dataset_storage()

    config = load_json(
        ACTIVE_DATASET_FILE,
        {"active_dataset_id": "synthetic_demo"}
    )

    dataset_id = config.get("active_dataset_id", "synthetic_demo")

    if get_dataset(dataset_id) is None:
        dataset_id = "synthetic_demo"

    return dataset_id


def get_active_dataset() -> dict:
    dataset_id = get_active_dataset_id()
    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise RuntimeError("Active dataset could not be found.")

    return dataset


def set_active_dataset(dataset_id: str) -> dict:
    initialize_dataset_storage()

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(f"Dataset '{dataset_id}' does not exist.")

    if dataset.get("status") != "ready":
        raise ValueError("This dataset is not ready to be activated.")

    save_json(
        ACTIVE_DATASET_FILE,
        {"active_dataset_id": dataset_id}
    )

    return dataset


# ---------------------------------------------------------
# DATASET DIRECTORIES
# ---------------------------------------------------------

def get_dataset_root(dataset_id: str) -> Path:
    if dataset_id == "synthetic_demo":
        return SYNTHETIC_DATA_DIR

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(f"Unknown dataset: {dataset_id}")

    return UPLOADS_DIR / dataset_id


def get_active_dataset_root() -> Path:
    return get_dataset_root(get_active_dataset_id())


def get_active_data_dir() -> Path:
    dataset = get_active_dataset()

    if dataset.get("type") == "synthetic":
        return SYNTHETIC_DATA_DIR

    return get_active_dataset_root() / "normalized"


def get_active_original_dir() -> Path:
    return get_active_dataset_root() / "original"


def get_active_generated_dir() -> Path:
    dataset = get_active_dataset()

    if dataset.get("type") == "synthetic":
        return SYNTHETIC_DATA_DIR

    generated_dir = get_active_dataset_root() / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)

    return generated_dir


# ---------------------------------------------------------
# DATA FILE RESOLUTION
# ---------------------------------------------------------

def get_dataset_file(
    filename: str,
    dataset_id: str | None = None
) -> Path:
    """
    Resolve a normalized dataset file.

    Synthetic Demo:
        backend/data/<filename>

    Uploaded Dataset:
        backend/uploads/<dataset_id>/normalized/<filename>
    """

    if Path(filename).name != filename:
        raise ValueError("Invalid dataset filename.")

    if dataset_id is None:
        dataset_id = get_active_dataset_id()

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(f"Unknown dataset: {dataset_id}")

    if dataset.get("type") == "synthetic":
        return SYNTHETIC_DATA_DIR / filename

    return UPLOADS_DIR / dataset_id / "normalized" / filename


def get_generated_file(
    filename: str,
    dataset_id: str | None = None
) -> Path:
    if Path(filename).name != filename:
        raise ValueError("Invalid generated filename.")

    if dataset_id is None:
        dataset_id = get_active_dataset_id()

    dataset = get_dataset(dataset_id)

    if dataset is None:
        raise ValueError(f"Unknown dataset: {dataset_id}")

    if dataset.get("type") == "synthetic":
        return SYNTHETIC_DATA_DIR / filename

    generated_dir = UPLOADS_DIR / dataset_id / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)

    return generated_dir / filename


# ---------------------------------------------------------
# REGISTER A NEW UPLOADED DATASET
# ---------------------------------------------------------

def register_uploaded_dataset(
    name: str,
    description: str = ""
) -> dict:
    initialize_dataset_storage()

    dataset_id = f"dataset_{uuid.uuid4().hex[:10]}"

    dataset_root = UPLOADS_DIR / dataset_id

    original_dir = dataset_root / "original"
    normalized_dir = dataset_root / "normalized"
    generated_dir = dataset_root / "generated"

    original_dir.mkdir(parents=True, exist_ok=False)
    normalized_dir.mkdir(parents=True, exist_ok=True)
    generated_dir.mkdir(parents=True, exist_ok=True)

    dataset = {
        "id": dataset_id,
        "name": name.strip(),
        "type": "uploaded",
        "description": description.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "processing",
        "files": [],
        "profile": {},
    }

    registry = get_dataset_registry()
    registry.setdefault("datasets", []).append(dataset)

    save_json(REGISTRY_FILE, registry)

    return dataset


# ---------------------------------------------------------
# UPDATE DATASET METADATA
# ---------------------------------------------------------

def update_dataset(
    dataset_id: str,
    updates: dict
) -> dict:
    registry = get_dataset_registry()

    for index, dataset in enumerate(registry.get("datasets", [])):
        if dataset.get("id") == dataset_id:
            dataset.update(updates)
            registry["datasets"][index] = dataset

            save_json(REGISTRY_FILE, registry)

            return dataset

    raise ValueError(f"Dataset '{dataset_id}' does not exist.")