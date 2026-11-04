import json
import unittest

from backend.history import HistoryStore
from support import fresh_path


class HistoryStoreTests(unittest.TestCase):
    def test_missing_history_starts_empty(self):
        self.assertEqual(HistoryStore(fresh_path("empty-history.json")).all(), [])

    def test_reads_legacy_list_and_assigns_missing_ids(self):
        path = fresh_path("legacy-history.json")
        path.write_text(json.dumps([{"id": "A", "items": ["Milk"]}]), encoding="utf-8")
        history = HistoryStore(path)
        self.assertTrue(history.all()[0]["record_id"])
        self.assertIn("orders", json.loads(path.read_text(encoding="utf-8")))

    def test_rejects_non_list_payload(self):
        path = fresh_path("invalid-history.json")
        path.write_text(json.dumps({"orders": "invalid"}), encoding="utf-8")
        with self.assertRaises(ValueError):
            HistoryStore(path)

    def test_records_updates_deletes_and_returns_copies(self):
        path = fresh_path("history-mutations.json")
        history = HistoryStore(path)
        entry = history.record({"id": "A", "items": ["Milk"]}, "employee")
        self.assertEqual(entry["employee"], "employee")
        self.assertEqual(history.update_items(entry["record_id"], ["Bread"])["items"], ["Bread"])
        self.assertIsNone(history.update_items("missing", []))
        returned = history.all()
        returned.clear()
        self.assertEqual(len(history.all()), 1)
        self.assertTrue(history.delete(entry["record_id"]))
        self.assertFalse(history.delete(entry["record_id"]))
        self.assertEqual(history.all(), [])


if __name__ == "__main__":
    unittest.main()
