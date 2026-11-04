import base64
import asyncio
import json
import importlib.util
import unittest
from pathlib import Path
import runpy
from unittest.mock import patch

import httpx
from starlette.websockets import WebSocket

from backend import main
from backend.history import HistoryStore
from backend.orders import OrderStore
from support import fresh_path


class FakeDetector:
    model = None

    def detect_jpeg(self, frame):
        return ["Milk"]


class ApiTests(unittest.TestCase):
    def request(self, method, url, **kwargs):
        async def send():
            transport = httpx.ASGITransport(app=main.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(method, url, **kwargs)
        return asyncio.run(send())

    def setUp(self):
        main.DB = fresh_path("api-users.sqlite3")
        orders_path = fresh_path("api-orders.json")
        history_path = fresh_path("api-history.json")
        main.orders = OrderStore(orders_path)
        orders_path.write_text(
            '{"orders":[{"id":"A","items":["Milk"]},{"id":"B","items":["Bread"]}]}',
            encoding="utf-8",
        )
        main.orders = OrderStore(orders_path)
        main.history = HistoryStore(history_path)
        main.detector = FakeDetector()
        main.SESSIONS.clear()

    def tearDown(self):
        main.SESSIONS.clear()
        main.DB.unlink(missing_ok=True)

    def register(self, username="worker", password="pass123"):
        return self.request("POST", "/api/auth/register", json={
            "username": username, "password": password, "dob": "2000-01-01",
            "national_id": "1234567890123", "first_name": "Test", "last_name": "User",
        })

    def login(self, username="worker", password="pass123"):
        return self.request("POST", "/api/auth/login", json={"username": username, "password": password})

    def add_admin(self):
        salt, password_hash = main.hash_admin_password("adminpass")
        con = main.db()
        con.execute("INSERT INTO admins VALUES (?, ?, ?, ?)", ("Admin", salt, password_hash, "now"))
        con.commit()
        con.close()
        return self.login("Admin", "adminpass").json()["token"]

    def test_health_and_static_frontend(self):
        self.assertEqual(self.request("GET", "/health").json(), {"status": "ok", "model_loaded": False})
        self.assertEqual(self.request("GET", "/").status_code, 200)

    def test_import_fails_when_frontend_directory_is_missing(self):
        spec = importlib.util.spec_from_file_location("backend.missing_frontend", Path(main.__file__))
        module = importlib.util.module_from_spec(spec)
        original_is_dir = Path.is_dir

        def missing_frontend(path):
            return False if path.name == "frontend" else original_is_dir(path)

        with patch.object(Path, "is_dir", missing_frontend), self.assertRaisesRegex(RuntimeError, "frontend"):
            spec.loader.exec_module(module)

    def test_database_bootstraps_admin_password_from_environment_only_once(self):
        with patch.object(main, "INITIAL_ADMIN_PASSWORD", "first-admin-password"):
            con = main.db()
            self.assertEqual(con.execute("SELECT COUNT(*) FROM admins").fetchone()[0], 1)
            con.close()
            con = main.db()
            self.assertEqual(con.execute("SELECT COUNT(*) FROM admins").fetchone()[0], 1)
            con.close()

    def test_main_module_entrypoint_starts_uvicorn(self):
        with patch("backend.main.OrderStore"), patch("backend.main.HistoryStore"), patch("backend.main.Detector"), patch("uvicorn.run") as server:
            runpy.run_path(main.__file__, run_name="__main__")
        server.assert_called_once()

    def test_register_validation_reserved_and_duplicate(self):
        self.assertEqual(self.register().status_code, 200)
        self.assertEqual(self.register().status_code, 409)
        self.assertEqual(self.register("Admin").status_code, 400)
        self.assertEqual(self.register("other", "123").status_code, 400)
        blank = {"username": " ", "password": "pass", "dob": "d", "national_id": "n", "first_name": "f", "last_name": "l"}
        self.assertEqual(self.request("POST", "/api/auth/register", json=blank).status_code, 400)

    def test_user_login_session_logout_and_invalid_credentials(self):
        self.register()
        self.assertEqual(self.login(password="wrong").status_code, 401)
        response = self.login()
        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]
        self.assertEqual(self.request("GET", "/api/auth/session", params={"token": token}).json()["role"], "employee")
        self.assertEqual(self.request("GET", "/api/auth/session", params={"token": "bad"}).status_code, 401)
        self.request("POST", "/api/auth/logout", json={"token": token})
        self.assertEqual(self.request("GET", "/api/auth/session", params={"token": token}).status_code, 401)

    def test_employee_cannot_use_admin_routes(self):
        self.register()
        token = self.login().json()["token"]
        self.assertEqual(self.request("GET", "/api/admin/overview", params={"token": token}).status_code, 403)
        self.assertEqual(self.request("GET", "/api/admin/overview", params={"token": "invalid"}).status_code, 401)

    def test_admin_overview_and_user_operations(self):
        self.register()
        token = self.add_admin()
        overview = self.request("GET", "/api/admin/overview", params={"token": token})
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["products"], ["Bread", "Milk"])
        self.assertEqual(self.request("PUT", "/api/admin/users/worker", params={"token": token}, json={"dob": "2001", "national_id": "id", "first_name": "New", "last_name": "Name"}).status_code, 200)
        self.assertEqual(self.request("PUT", "/api/admin/users/missing", params={"token": token}, json={"dob": "d", "national_id": "i", "first_name": "f", "last_name": "l"}).status_code, 404)
        self.assertEqual(self.request("DELETE", "/api/admin/users/worker", params={"token": token}).status_code, 200)

    def test_order_history_and_admin_history_mutations(self):
        self.assertEqual(self.request("GET", "/api/orders/current").json()["id"], "A")
        self.assertEqual(self.request("POST", "/api/orders/next").json()["id"], "B")
        self.assertIn(self.request("POST", "/api/orders/random").json()["id"], {"A", "B"})
        self.assertEqual(self.request("GET", "/api/orders/history").json(), {"orders": []})
        token = self.add_admin()
        record = main.history.record({"id": "A", "items": ["Milk"]})
        path = f"/api/admin/completed-orders/{record['record_id']}"
        self.assertEqual(self.request("PUT", path, params={"token": token}, json={"items": [" Bread ", "", "Milk"]}).json()["items"], ["Bread", "Milk"])
        self.assertEqual(self.request("PUT", "/api/admin/completed-orders/nope", params={"token": token}, json={"items": []}).status_code, 404)
        self.assertEqual(self.request("DELETE", path, params={"token": token}).status_code, 200)
        self.assertEqual(self.request("DELETE", path, params={"token": token}).status_code, 404)

    def test_detect_valid_and_invalid_base64(self):
        encoded = base64.b64encode(b"frame").decode()
        result = self.request("POST", "/api/detect", json={"image": encoded})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["status"], "PASS")
        self.assertEqual(self.request("POST", "/api/detect", json={"image": "%%%"}).status_code, 400)

    def test_websocket_order_completion_and_frame_messages(self):
        main.SESSIONS["employee-token"] = "worker"
        incoming = [
            {"type": "websocket.connect"},
            {"type": "websocket.receive", "text": json.dumps({"type": "next_order"})},
            {"type": "websocket.receive", "text": json.dumps({"type": "complete_and_next"})},
            {"type": "websocket.receive", "text": json.dumps({"type": "frame", "image": base64.b64encode(b"frame").decode()})},
            {"type": "websocket.receive", "text": json.dumps({"type": "frame", "image": "%%%"})},
            {"type": "websocket.disconnect", "code": 1000},
        ]
        outgoing = []

        async def receive():
            return incoming.pop(0)

        async def send(message):
            outgoing.append(message)

        scope = {
            "type": "websocket", "asgi": {"version": "3.0"}, "scheme": "ws",
            "path": "/ws/detect", "raw_path": b"/ws/detect", "query_string": b"token=employee-token",
            "headers": [], "client": ("test", 1), "server": ("test", 80), "subprotocols": [],
            "state": {}, "app": main.app,
        }
        asyncio.run(main.websocket_detect(WebSocket(scope, receive, send)))
        responses = [json.loads(message["text"]) for message in outgoing if message["type"] == "websocket.send"]
        self.assertEqual([message["type"] for message in responses], ["order", "order", "order", "detection", "error"])
        self.assertEqual(responses[-1]["message"], "Only base64 data is allowed")
        self.assertEqual(len(main.history.all()), 1)


if __name__ == "__main__":
    unittest.main()
