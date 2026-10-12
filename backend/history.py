import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock


class HistoryStore:
    """Persist completed simulated orders separately from application logic."""

    def __init__(self, path: Path):
        self.path = path
        self.lock = Lock()
        self.entries = self._load()

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        with self.path.open(encoding="utf-8") as file:
            payload = json.load(file)
        return payload.get("orders", []) if isinstance(payload, dict) else payload

    def record(self, order: dict) -> dict:
        entry = {
            "id": order["id"],
            "items": order["items"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        with self.lock:
            self.entries.insert(0, entry)
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("w", encoding="utf-8") as file:
                json.dump({"orders": self.entries}, file, ensure_ascii=False, indent=2)
        return entry

    def all(self) -> list[dict]:
        with self.lock:
            return self.entries.copy()
