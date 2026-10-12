from pathlib import Path
from random import randrange
from threading import Lock


class OrderStore:
    # เก็บ order ใน JSON และใช้ lock เพื่อรองรับหลาย request พร้อมกัน
    def __init__(self, path: Path):
        self.path, self.lock, self.index = path, Lock(), 0
        self.orders = self._load()

    def _load(self):
        # อ่านไฟล์ข้อมูล order หรือคืน order ตัวอย่างเมื่อยังไม่มีไฟล์
        if self.path.exists():
            import json
            with self.path.open(encoding="utf-8") as file:
                payload = json.load(file)
            return payload["orders"] if isinstance(payload, dict) else payload
        return [{"id": "DEMO-001", "items": ["Milk", "Bread", "Water"]}]

    def current(self):
        with self.lock:
            return self.orders[self.index]

    def next(self):
        with self.lock:
            self.index = (self.index + 1) % len(self.orders)
            return self.orders[self.index]

    def random(self):
        with self.lock:
            self.index = randrange(len(self.orders))
            return self.orders[self.index]
