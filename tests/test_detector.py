import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from backend.detector import Detector, compare


class DetectorTests(unittest.TestCase):
    def test_missing_model_returns_no_detections(self):
        with patch("backend.detector.logging.warning"):
            detector = Detector(Path("not-a-real-model.pt"))
        self.assertEqual(detector.detect_jpeg(b"anything"), [])

    def test_load_error_is_logged_and_detector_stays_unavailable(self):
        with patch.object(Path, "exists", return_value=True), patch("ultralytics.YOLO", side_effect=RuntimeError("bad model")), patch("backend.detector.logging.exception"):
            detector = Detector(Path("bad.pt"))
        self.assertIsNone(detector.model)

    def test_invalid_jpeg_raises_value_error(self):
        detector = Detector(Path("missing.pt"))
        detector.model = object()
        with self.assertRaisesRegex(ValueError, "valid JPEG"):
            detector.detect_jpeg(b"not jpeg")

    def test_detect_maps_aliases_and_normalizes_labels(self):
        detector = Detector(Path("missing.pt"))
        detector.model = lambda *args, **kwargs: [SimpleNamespace(names={0: "Biskist", 1: "Tissue"}, boxes=[SimpleNamespace(cls=[0]), SimpleNamespace(cls=[1])])]
        with patch("backend.detector.cv2.imdecode", return_value=object()), patch("backend.detector.np.frombuffer", return_value=object()):
            self.assertEqual(detector.detect_jpeg(b"jpeg"), ["Biscuit", "Tissue"])

    def test_compare_reports_match_and_mismatches(self):
        self.assertEqual(compare(["Milk", "Milk"], ["Milk", "Milk"])["status"], "PASS")
        result = compare(["Milk", "Bread"], ["Milk", "Water"])
        self.assertEqual(result["status"], "CHECK")
        self.assertEqual(result["missing"], ["Bread"])
        self.assertEqual(result["unexpected"], ["Water"])


if __name__ == "__main__":
    unittest.main()
