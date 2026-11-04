from pathlib import Path


TEMP_DIR = Path(__file__).resolve().parent / ".tmp"
TEMP_DIR.mkdir(exist_ok=True)


def fresh_path(name: str) -> Path:
    path = TEMP_DIR / name
    path.unlink(missing_ok=True)
    return path
