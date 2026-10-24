"""
TEST DATA ONLY — this generates fake .psv files matching the PhysioNet
Challenge 2019 format for isolated pipeline smoke checks. It writes to
data/synthetic_raw so it cannot mix with or overwrite records in data/raw.

Real dataset: https://physionet.org/content/challenge-2019/1.0.0/
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)

COLUMNS = [
    "HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp", "EtCO2",
    "BaseExcess", "HCO3", "FiO2", "pH", "PaCO2", "SaO2", "AST", "BUN",
    "Alkalinephos", "Calcium", "Chloride", "Creatinine", "Bilirubin_direct",
    "Glucose", "Lactate", "Magnesium", "Phosphate", "Potassium",
    "Bilirubin_total", "TroponinI", "Hct", "Hgb", "PTT", "WBC",
    "Fibrinogen", "Platelets", "Age", "Gender", "Unit1", "Unit2",
    "HospAdmTime", "ICULOS", "SepsisLabel"
]

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_raw")
os.makedirs(RAW_DIR, exist_ok=True)


def make_patient(patient_id: int, is_septic: bool, n_hours: int):
    rows = []
    # baseline physiology, septic patients trend worse over time
    hr = np.random.normal(80, 8)
    map_val = np.random.normal(78, 6)
    lactate = np.random.normal(1.2, 0.3)
    wbc = np.random.normal(8.0, 1.5)
    temp = np.random.normal(37.0, 0.4)
    resp = np.random.normal(16, 2)

    sepsis_onset_hour = np.random.randint(n_hours // 2, n_hours) if is_septic else None

    for h in range(n_hours):
        drift = 0.0
        septic_now = is_septic and sepsis_onset_hour is not None and h >= sepsis_onset_hour
        if septic_now:
            drift = (h - sepsis_onset_hour) * 0.15

        row = {c: "" for c in COLUMNS}
        row["HR"] = round(hr + drift * 3 + np.random.normal(0, 3), 1)
        row["MAP"] = round(map_val - drift * 2 + np.random.normal(0, 2), 1)
        row["Temp"] = round(temp + drift * 0.15 + np.random.normal(0, 0.2), 1)
        row["Resp"] = round(resp + drift * 1.2 + np.random.normal(0, 1), 1)
        row["O2Sat"] = round(max(85, 98 - drift * 1.5 + np.random.normal(0, 1)), 1)
        # labs measured less frequently -> leave blank most hours (realistic sparsity)
        if h % 4 == 0:
            row["Lactate"] = round(max(0.5, lactate + drift * 0.6 + np.random.normal(0, 0.2)), 2)
            row["WBC"] = round(max(2.0, wbc + drift * 0.8 + np.random.normal(0, 0.5)), 1)
            row["Platelets"] = round(max(50, 250 - drift * 10 + np.random.normal(0, 15)), 0)
            row["Creatinine"] = round(max(0.4, 0.9 + drift * 0.1 + np.random.normal(0, 0.1)), 2)

        row["Age"] = np.random.randint(40, 85)
        row["Gender"] = np.random.randint(0, 2)
        row["ICULOS"] = h + 1
        row["SepsisLabel"] = 1 if septic_now else 0
        rows.append(row)

    return pd.DataFrame(rows, columns=COLUMNS)


def main(n_patients=60):
    for i in range(n_patients):
        is_septic = i % 3 == 0  # ~33% septic, roughly plausible ICU prevalence for this synthetic set
        n_hours = np.random.randint(20, 60)
        df = make_patient(i, is_septic, n_hours)
        path = os.path.join(RAW_DIR, f"p{i:05d}.psv")
        df.to_csv(path, sep="|", index=False)

    print(f"Wrote {n_patients} synthetic .psv files to {RAW_DIR}")
    print("These files are synthetic smoke-test data; do not report them as clinical training data.")


if __name__ == "__main__":
    main()
