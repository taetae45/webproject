"""Run backend tests and export their Python line coverage as Cobertura XML."""

import dis
import os
import sys
import threading
import time
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "coverage" / "python-coverage.xml"
sys.path.insert(0, str(ROOT))


def executable_lines(code):
    lines = {line for _, line in dis.findlinestarts(code) if line and line > 0}
    for value in code.co_consts:
        if isinstance(value, type(code)):
            lines.update(executable_lines(value))
    return lines


def run_tests():
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    return unittest.TextTestRunner(verbosity=2).run(suite)


def main():
    counts = {}
    root_prefix = str(ROOT).casefold() + os.sep

    def record_lines(frame, event, _arg):
        filename = frame.f_code.co_filename
        normalized = filename.casefold()
        if not normalized.startswith(root_prefix):
            return None
        relative = normalized[len(root_prefix):]
        if not (relative == "run.py" or relative.startswith(f"backend{os.sep}")):
            return None
        if event == "line":
            resolved = Path(filename).resolve()
            key = (str(resolved), frame.f_lineno)
            counts[key] = counts.get(key, 0) + 1
        return record_lines

    sys.settrace(record_lines)
    threading.settrace(record_lines)
    try:
        result = run_tests()
    finally:
        sys.settrace(None)
        threading.settrace(None)
    classes = []

    for source in sorted([ROOT / "run.py", * (ROOT / "backend").rglob("*.py")]):
        source_lines = executable_lines(compile(source.read_text(encoding="utf-8"), str(source), "exec"))
        filename = source.relative_to(ROOT).as_posix()
        hits = {line: count for (path, line), count in counts.items() if Path(path).resolve() == source.resolve()}
        lines = sorted(source_lines)
        covered = sum(hits.get(line, 0) > 0 for line in lines)
        rate = covered / len(lines) if lines else 1.0
        classes.append((filename, lines, hits, covered, rate))

    valid = sum(len(lines) for _, lines, _, _, _ in classes)
    covered = sum(count for _, _, _, count, _ in classes)
    line_rate = covered / valid if valid else 1.0
    report = ET.Element("coverage", {
        "lines-valid": str(valid), "lines-covered": str(covered),
        "line-rate": f"{line_rate:.4f}", "branches-valid": "0",
        "branches-covered": "0", "branch-rate": "0", "complexity": "0",
        "version": "stdlib-trace", "timestamp": str(int(time.time() * 1000)),
    })
    sources = ET.SubElement(report, "sources")
    ET.SubElement(sources, "source").text = str(ROOT)
    packages = ET.SubElement(report, "packages")
    for filename, lines, hits, file_covered, file_rate in classes:
        package_name = str(Path(filename).parent).replace("\\", ".").replace("/", ".")
        package = ET.SubElement(packages, "package", {
            "name": package_name, "line-rate": f"{file_rate:.4f}",
            "branch-rate": "0", "complexity": "0",
        })
        classes_node = ET.SubElement(package, "classes")
        class_node = ET.SubElement(classes_node, "class", {
            "name": Path(filename).stem, "filename": filename,
            "line-rate": f"{file_rate:.4f}", "branch-rate": "0", "complexity": "0",
        })
        lines_node = ET.SubElement(class_node, "lines")
        for line in lines:
            ET.SubElement(lines_node, "line", {
                "number": str(line), "hits": str(hits.get(line, 0)),
            })

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(report, space="  ")
    ET.ElementTree(report).write(REPORT, encoding="utf-8", xml_declaration=True)
    print(f"Python coverage: {covered}/{valid} executable lines ({line_rate:.1%})")
    print(f"Cobertura report: {REPORT.relative_to(ROOT)}")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
