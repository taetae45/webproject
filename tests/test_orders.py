import json
import unittest
from unittest.mock import patch

from backend.orders import OrderStore
from support import fresh_path


class OrderStoreTests(unittest.TestCase):
    def test_loads_list_and_cycles_current_next(self):
        path = fresh_path("orders-list.json")
        path.write_text(json.dumps([{"id": "1", "items": ["Milk"]}, {"id": "2", "items": ["Bread"]}]), encoding="utf-8")
        store = OrderStore(path)
        self.assertEqual(store.current()["id"], "1")
        self.assertEqual(store.next()["id"], "2")
        self.assertEqual(store.next()["id"], "1")

    def test_loads_orders_object(self):
        path = fresh_path("orders-object.json")
        path.write_text(json.dumps({"orders": [{"id": "A", "items": []}]}), encoding="utf-8")
        self.assertEqual(OrderStore(path).current()["id"], "A")

    def test_uses_demo_order_if_file_is_missing(self):
        store = OrderStore(fresh_path("missing-orders.json"))
        self.assertEqual(store.current()["id"], "DEMO-001")

    def test_random_selects_index_from_order_count(self):
        path = fresh_path("orders-random.json")
        path.write_text(json.dumps([{"id": "1", "items": []}, {"id": "2", "items": []}]), encoding="utf-8")
        store = OrderStore(path)
        with patch("backend.orders.randrange", return_value=1) as choose:
            self.assertEqual(store.random()["id"], "2")
        choose.assert_called_once_with(2)


if __name__ == "__main__":
    unittest.main()
