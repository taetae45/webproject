import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4


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
        changed = False
        for order in orders:
            if not order.get("record_id"):
                order["record_id"] = uuid4().hex
                changed = True
        if changed:
            self._save(orders)
        return orders

    def _save(self, orders: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as history_file:
            json.dump({"orders": orders}, history_file, ensure_ascii=False, indent=2)

    def record(self, finished_order: dict, employee: str | None = None) -> dict:
        history_entry = {
            "record_id": uuid4().hex,
            "id": finished_order["id"],
            "items": finished_order["items"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "employee": employee,
        }

        with self._lock:
            updated_orders = [history_entry, *self._completed_orders]
            self._save(updated_orders)
            self._completed_orders = updated_orders

        return history_entry

    def all(self) -> list[dict]:
        with self._lock:
            return self._completed_orders.copy()

    def update_items(self, record_id: str, items: list[str]) -> dict | None:
        with self._lock:
            order = next((row for row in self._completed_orders if row["record_id"] == record_id), None)
            if order is None:
                return None
            order["items"] = items
            self._save(self._completed_orders)
            return order.copy()

    def delete(self, record_id: str) -> bool:
        with self._lock:
            updated = [row for row in self._completed_orders if row["record_id"] != record_id]
            if len(updated) == len(self._completed_orders):
                return False
            self._save(updated)
            self._completed_orders = updated
            return True
