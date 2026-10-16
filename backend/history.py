import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock


class HistoryStore:
    """Keep a local record of simulated orders the operator has finished."""

    def __init__(self, path: Path):
        self.path = path
        self._lock = Lock()
        self._completed_orders = self._read_saved_orders()

    def _read_saved_orders(self) -> list[dict]:
        if not self.path.exists():
            return []

        with self.path.open(encoding="utf-8") as history_file:
            saved = json.load(history_file)

        # A few earlier demo files used a bare list instead of the orders key.
        orders = saved.get("orders") if isinstance(saved, dict) else saved
        if not isinstance(orders, list):
            raise ValueError(f"Order history in {self.path} must contain a list of orders")
        return orders

    def record(self, finished_order: dict) -> dict:
        history_entry = {
            "id": finished_order["id"],
            "items": finished_order["items"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        with self._lock:
            updated_orders = [history_entry, *self._completed_orders]
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("w", encoding="utf-8") as history_file:
                json.dump(
                    {"orders": updated_orders},
                    history_file,
                    ensure_ascii=False,
                    indent=2,
                )
            self._completed_orders = updated_orders

        return history_entry

    def all(self) -> list[dict]:
        with self._lock:
            return self._completed_orders.copy()
