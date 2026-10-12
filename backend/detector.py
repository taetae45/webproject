from collections import Counter
from pathlib import Path
import logging
import cv2
import numpy as np

# ชื่อที่ต้องการใช้ในระบบ กรณีชื่อ class ในโมเดลสะกดต่างจากชื่อสินค้า
LABEL_ALIASES = {"Biskis": "Biscuit"}


class Detector:
    # โหลดโมเดลเพียงครั้งเดียวเมื่อ backend เริ่มทำงาน
    def __init__(self, model_path: Path):
        self.model = None
        if model_path.exists():
            try:
                from ultralytics import YOLO
                self.model = YOLO(str(model_path))
                logging.info("Loaded YOLO model from %s", model_path)
            except Exception:
                logging.exception("Could not load YOLO model")
        else:
            logging.warning("No model at %s; add backend/models/best.pt", model_path)

    def detect_jpeg(self, frame_bytes: bytes) -> list[str]:
        # เปลี่ยน JPEG เป็น OpenCV image แล้วคืนชื่อ class ที่ YOLO ตรวจพบ
        if not self.model:
            return []
        image = cv2.imdecode(np.frombuffer(frame_bytes, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("The received frame is not a valid JPEG")
        # Values match the local model test configuration supplied with the project.
        result = self.model(image, conf=0.80, iou=0.30, verbose=False)[0]
        labels = [str(result.names[int(box.cls[0])]) for box in result.boxes]
        return [LABEL_ALIASES.get(label, label) for label in labels]


def compare(expected: list[str], detected: list[str]) -> dict:
    # เปรียบเทียบจำนวนสินค้าใน order กับจำนวนที่ตรวจพบ
    expected_counts, detected_counts = Counter(expected), Counter(detected)
    return {
        "detected": sorted(detected_counts),
        "detected_counts": dict(detected_counts),
        "found": [item for item in expected if detected_counts[item] > 0],
        "missing": list((expected_counts - detected_counts).elements()),
        "unexpected": list((detected_counts - expected_counts).elements()),
        "status": "PASS" if expected_counts == detected_counts else "CHECK",
    }
