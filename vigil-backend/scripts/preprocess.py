"""Build one leakage-aware training snapshot per PhysioNet patient.

For patients with a positive SepsisLabel, use the first warning hour (the
Challenge's warning window begins six hours before onset).
For non-sepsis control patients, snapshot at an hour sampled from the cases'
ICULOS distribution so the model cannot learn time-in-ICU.
Features are forward-filled from past only: later measurements are never copied
into an earlier snapshot. Missing features remain blank for XGBoost's native handling.
ICULOS is NOT included as a feature.
"""

import csv
import glob
import json
import os
import random
import argparse

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

FEATURE_NAMES = ["HR", "MAP", "Resp", "Temp", "O2Sat", "Lactate", "WBC", "Platelets", "Creatinine", "HCO3", "BUN", "Glucose", "Bilirubin_total"]
MISSING_TOKENS = {"", "nan", "na", "none", "null"}


def _parse_float(value):
    if value is None or value.strip().lower() in MISSING_TOKENS:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def parse_patient_file(path):
    """
    Parse a single patient PSV file.
    Returns:
        dict with:
            is_case: bool
            first_positive: tuple (values, iculos_hour) or None
            snapshots: list of (values, iculos_hour)
            source_file: filename
        or None if invalid/empty
    """
    try:
        with open(path, newline="") as f:
            reader = csv.reader(f, delimiter="|")
            header = next(reader, None)
            if not header:
                return None
            idx = {name: i for i, name in enumerate(header)}
            needed = FEATURE_NAMES + ["SepsisLabel"]
            if any(name not in idx for name in needed):
                return None

            feature_idx = [idx[name] for name in FEATURE_NAMES]
            label_idx = idx["SepsisLabel"]
            hour_idx = idx.get("ICULOS")

            last_values = [None] * len(FEATURE_NAMES)
            snapshots = []
            first_positive = None

            for row_number, row in enumerate(reader):
                for i, col in enumerate(feature_idx):
                    if col < len(row):
                        value = _parse_float(row[col])
                        if value is not None:
                            last_values[i] = value

                hour = _parse_float(row[hour_idx]) if hour_idx is not None and hour_idx < len(row) else None
                current_hour = hour if hour is not None else float(row_number + 1)
                current = (list(last_values), current_hour)
                snapshots.append(current)

                label = _parse_float(row[label_idx]) if label_idx < len(row) else None
                if first_positive is None and label is not None and label > 0:
                    first_positive = current

            if not snapshots:
                return None

            return {
                "source_file": os.path.basename(path),
                "is_case": first_positive is not None,
                "first_positive": first_positive,
                "snapshots": snapshots,
            }
    except (OSError, csv.Error, UnicodeError):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    default_max = int(os.environ.get("MAX_PATIENTS", "8000"))
    parser.add_argument(
        "--max-patients",
        type=int,
        default=default_max,
        help="maximum patient files to sample (default from MAX_PATIENTS env var or 8000)",
    )
    parser.add_argument("--output-dir", default=PROCESSED_DIR, help="directory for processed snapshots")
    parser.add_argument("--seed", type=int, default=42, help="random seed for sampling")
    args = parser.parse_args()

    all_files = sorted(glob.glob(os.path.join(RAW_DIR, "*.psv")))
    if not all_files:
        raise SystemExit(f"No .psv files found in {RAW_DIR}.")

    # Only select files that are fully present on local disk (st_blocks > 0)
    # to avoid macOS iCloud Drive sync stalls on evicted placeholders.
    local_files = [f for f in all_files if os.stat(f).st_blocks > 0]
    print(f"Total raw files: {len(all_files)}; Locally hydrated on disk: {len(local_files)}")
    
    files_to_sample = local_files if local_files else all_files

    rng = random.Random(args.seed)
    if args.max_patients and args.max_patients < len(files_to_sample):
        print(f"Sampling {args.max_patients} patient files from {len(files_to_sample)} available files (seed={args.seed})...")
        sampled_files = rng.sample(files_to_sample, args.max_patients)
        sampled_files.sort()
    else:
        print(f"Using {len(files_to_sample)} available patient files...")
        sampled_files = files_to_sample

    os.makedirs(args.output_dir, exist_ok=True)

    cases = []
    controls = []
    case_iculos_pool = []
    skipped = 0
    cases_skipped_none = 0
    controls_skipped_none = 0

    print(f"Parsing {len(sampled_files)} patient records...")
    for i, path in enumerate(sampled_files, 1):
        parsed = parse_patient_file(path)
        if parsed is None:
            skipped += 1
            continue

        if parsed["is_case"]:
            values, snapshot_hour = parsed["first_positive"]
            if all(v is None for v in values):
                cases_skipped_none += 1
                skipped += 1
                continue
            case_record = {FEATURE_NAMES[k]: values[k] for k in range(len(FEATURE_NAMES))}
            case_record.update({
                "sepsis_label": 1,
                "source_file": parsed["source_file"],
                "snapshot_hour": snapshot_hour,
                "snapshot_type": "first_warning_hour",
            })
            cases.append(case_record)
            if snapshot_hour is not None:
                case_iculos_pool.append(snapshot_hour)
        else:
            controls.append(parsed)

        if i % 500 == 0 or i == len(sampled_files):
            print(f"  Parsed {i}/{len(sampled_files)} files (found {len(cases)} cases, {len(controls)} controls)...", flush=True)

    if not cases:
        raise SystemExit("No sepsis cases found in the sampled patient files.")

    print(f"Case ICULOS distribution: {len(case_iculos_pool)} warning hours (mean={sum(case_iculos_pool)/len(case_iculos_pool):.1f}, min={min(case_iculos_pool)}, max={max(case_iculos_pool)})")

    # Match controls to case warning hours. Snapshots already contain values
    # forward-filled from earlier rows only; never search later in the stay.
    def matched_control_record(ctrl):
        snapshots = ctrl["snapshots"]
        stay_length = len(snapshots)

        valid_case_hours = [h for h in case_iculos_pool if h <= stay_length]
        if not valid_case_hours:
            return None
        target_hour = rng.choice(valid_case_hours)

        idx = min(max(0, int(round(target_hour)) - 1), stay_length - 1)
        values, actual_hour = snapshots[idx]
        if all(v is None for v in values):
            return None

        ctrl_record = {FEATURE_NAMES[k]: values[k] for k in range(len(FEATURE_NAMES))}
        ctrl_record.update({
            "sepsis_label": 0,
            "source_file": ctrl["source_file"],
            "snapshot_hour": actual_hour,
            "snapshot_type": "iculos_matched_control",
        })
        return ctrl_record

    # If a sampled control has no usable past-only snapshot at its matched
    # hour, discard it and draw another control patient from the available
    # unsampled files; each replacement hour is drawn from the same case
    # warning-hour distribution above.
    control_records = []
    desired_controls = len(controls)
    for ctrl in controls:
        record = matched_control_record(ctrl)
        if record is None:
            controls_skipped_none += 1
            skipped += 1
        else:
            control_records.append(record)

    sampled_file_set = set(sampled_files)
    replacement_files = [f for f in all_files if f not in sampled_file_set]
    rng.shuffle(replacement_files)
    replacements_parsed = 0
    for path in replacement_files:
        if len(control_records) >= desired_controls:
            break
        parsed = parse_patient_file(path)
        if parsed is None or parsed["is_case"]:
            continue
        replacements_parsed += 1
        record = matched_control_record(parsed)
        if record is None:
            controls_skipped_none += 1
            continue
        control_records.append(record)

    all_rows = cases + control_records
    rng.shuffle(all_rows)

    out_path = os.path.join(args.output_dir, "sepsis_train.csv")
    columns = FEATURE_NAMES + ["sepsis_label", "source_file", "snapshot_hour", "snapshot_type"]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    with open(os.path.join(args.output_dir, "features.json"), "w") as f:
        json.dump(FEATURE_NAMES, f, indent=2)

    positives = len(cases)
    print(f"\nCompleted preprocessing:")
    print(f"Raw files found: {len(all_files)} | Locally hydrated: {len(local_files)} | Sampled for parsing: {len(sampled_files)}")
    print(f"Successfully parsed: {len(cases) + len(controls) + replacements_parsed} | Parse failures: {skipped - cases_skipped_none - controls_skipped_none}")
    print(f"  Cases found: {len(cases)} | Cases skipped (all-None features): {cases_skipped_none}")
    print(f"  Controls found: {len(controls)} | Replacement controls parsed: {replacements_parsed} | Controls skipped (no valid snapshot): {controls_skipped_none}")
    print(f"Total usable patient snapshots: {len(all_rows)}")
    print(f"Cases (first warning hour): {positives} ({positives / len(all_rows):.2%})")
    print(f"Controls (ICULOS-distribution matched): {len(control_records)}")
    print(f"Wrote {out_path} and features.json")


if __name__ == "__main__":
    main()
