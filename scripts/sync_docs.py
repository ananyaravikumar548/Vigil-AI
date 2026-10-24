"""Sync published metric placeholders and regenerate the source appendix."""

from datetime import datetime, timezone
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
METRICS_PATH = ROOT / "vigil-backend/app/ml_engine/metrics.json"
SOURCE_ROOTS = [ROOT / "scripts", ROOT / "vigil-backend/app", ROOT / "vigil-backend/scripts", ROOT / "vigil-frontend/src"]


def sync_metrics() -> None:
    metrics = json.loads(METRICS_PATH.read_text())
    positives = int(metrics["positives"])
    patients = int(metrics["n_patients_used"])
    confusion = metrics["confusion_counts"]
    confusion_line = (
        f"TN {confusion['tn']:,}, FP {confusion['fp']:,}, "
        f"FN {confusion['fn']:,}, TP {confusion['tp']:,}"
    )
    table = "\n".join(
        [
            "| Metric | Value |",
            "|---|---|",
            f"| Patients used | {patients:,} ({positives:,} sepsis cases, {patients - positives:,} controls) |",
            f"| Train / test | {metrics['n_train']:,} / {metrics['n_test']:,} (patient-disjoint, stratified; train includes validation) |",
            f"| AUROC | {metrics['AUROC']:.4f} |",
            f"| Average precision | {metrics['average_precision']:.4f} (holdout prevalence: {metrics['test_positive_rate'] * 100:.2f}%) |",
            f"| Brier score | {metrics['brier_score']:.4f} |",
            f"| Calibration | {metrics['calibration']} |",
            f"| Decision threshold | {metrics['threshold']:.2f} (tuned on validation split) |",
            f"| Holdout confusion counts | {confusion_line} |",
        ]
    )
    one_pager = (
        f"**Real metrics (holdout).** {patients:,} patients ({positives:,} cases, "
        f"{metrics['positive_rate'] * 100:.2f}% overall positive). AUROC {metrics['AUROC']:.4f}, "
        f"average precision {metrics['average_precision']:.4f} vs "
        f"{metrics['test_positive_rate'] * 100:.2f}% holdout prevalence, "
        f"Brier score {metrics['brier_score']:.4f}. The decision threshold is "
        f"{metrics['threshold']:.2f} (validation-tuned); confusion counts: {confusion_line}."
    )
    demo_metrics = (
        f"Synced holdout metrics: {patients:,} patients, {positives:,} positives, "
        f"AUROC {metrics['AUROC']:.4f}, AP {metrics['average_precision']:.4f}, "
        f"Brier {metrics['brier_score']:.4f}, threshold {metrics['threshold']:.2f}, "
        f"confusion counts {confusion_line}. Read the values from the live panel."
    )
    blocks = {
        ROOT / "README.md": table,
        ROOT / "docs/one_pager.md": one_pager,
        ROOT / "docs/demo_script.md": demo_metrics,
    }
    for path, block in blocks.items():
        text = path.read_text()
        start = "<!-- AUTO_METRICS_START -->"
        end = "<!-- AUTO_METRICS_END -->"
        before, start_marker, tail = text.partition(start)
        current, end_marker, after = tail.partition(end)
        if not start_marker or not end_marker:
            raise ValueError(f"Missing metric markers in {path}")
        path.write_text(before + start_marker + "\n" + block + "\n" + end_marker + after)


def regenerate_source_appendix() -> None:
    source_files = sorted(
        path
        for source_root in SOURCE_ROOTS
        for path in source_root.rglob("*")
        if path.is_file() and path.suffix in {".py", ".json", ".ts", ".tsx", ".css"}
        and "__pycache__" not in path.parts
    )
    sections = [
        "=" * 80,
        "Vigil AI — Developer Source Code",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "=" * 80,
        "",
    ]
    for path in source_files:
        sections.extend(
            [
                "=" * 80,
                f"FILE: {path.relative_to(ROOT).as_posix()}",
                "=" * 80,
                "",
                path.read_text(errors="replace").rstrip(),
                "",
            ]
        )
    (ROOT / "docs/code.txt").write_text("\n".join(sections).rstrip() + "\n")


if __name__ == "__main__":
    sync_metrics()
    regenerate_source_appendix()
    print("Synced README.md, docs/one_pager.md, docs/demo_script.md, and docs/code.txt")
