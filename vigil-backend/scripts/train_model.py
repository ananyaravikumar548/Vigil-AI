"""Train, calibrate, and evaluate Vigil's PhysioNet snapshot classifier."""

import argparse
import datetime
import json
import os
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "ml_engine")
os.makedirs(MODEL_DIR, exist_ok=True)


class SigmoidCalibrator:
    """Platt scaling (sigmoid calibration) fit on validation margin outputs."""

    def __init__(self, base_model, lr_model):
        self.base_model = base_model
        self.lr_model = lr_model

    def predict_proba(self, X):
        margin = self.base_model.predict(X, output_margin=True).reshape(-1, 1)
        return self.lr_model.predict_proba(margin)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--processed-dir", default=PROCESSED_DIR)
    parser.add_argument("--model-dir", default=MODEL_DIR)
    args = parser.parse_args()
    os.makedirs(args.model_dir, exist_ok=True)

    csv_path = os.path.join(args.processed_dir, "sepsis_train.csv")
    features_path = os.path.join(args.processed_dir, "features.json")
    if not os.path.exists(csv_path):
        raise SystemExit(f"No processed training data found at {csv_path}. Run scripts/preprocess.py first.")

    df = pd.read_csv(csv_path)
    with open(features_path) as f:
        feature_names = json.load(f)

    if "source_file" not in df or df["source_file"].duplicated().any():
        raise SystemExit("Expected exactly one snapshot per patient; duplicate source_file rows found.")

    X = df[feature_names]
    y = df["sepsis_label"].astype(int)

    if y.nunique() < 2:
        raise SystemExit("Training data must contain both positive and negative patient snapshots.")

    # 1. Patient-disjoint stratified holdout test split (20%)
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 2. Carve validation split (25% of train_val = 20% of total) for tuning and probability calibration
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.25, random_state=42, stratify=y_train_val
    )

    print(f"Data splits: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")
    print(f"Positive rate: Overall={y.mean():.2%}, Train={y_train.mean():.2%}, Val={y_val.mean():.2%}, Test={y_test.mean():.2%}")

    # 3. Handle class imbalance using scale_pos_weight
    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    scale_pos_weight = neg_count / max(1, pos_count)
    print(f"Computed scale_pos_weight: {scale_pos_weight:.2f}")

    # Monotone constraints: risk increases with Lactate, Resp, HR, WBC, Creatinine, Temp;
    # decreases with MAP, O2Sat, Platelets. Unconstrained: HCO3, BUN, Glucose, Bilirubin_total.
    # Feature order: HR(0), MAP(1), Resp(2), Temp(3), O2Sat(4), Lactate(5), WBC(6), Platelets(7),
    # Creatinine(8), HCO3(9), BUN(10), Glucose(11), Bilirubin_total(12)
    MONOTONE_CONSTRAINTS = "(1,-1,1,1,-1,1,1,-1,1,0,0,0,0)"

    # 4. Train base XGBoost model
    base_model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=2.0,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=42,
        n_jobs=4,
        monotone_constraints=MONOTONE_CONSTRAINTS,
    )
    base_model.fit(X_train, y_train)

    # 5. Fit Platt sigmoid calibration on validation margins
    val_margins = base_model.predict(X_val, output_margin=True).reshape(-1, 1)
    lr = LogisticRegression(C=1.0, solver="lbfgs")
    lr.fit(val_margins, y_val)

    calibrator = SigmoidCalibrator(base_model, lr)

    # Tune decision threshold on validation set using F1
    val_probs = calibrator.predict_proba(X_val)[:, 1]
    best_thresh = 0.5
    best_f1 = 0.0
    for thresh in [0.2, 0.3, 0.4, 0.5, 0.6]:
        f1 = f1_score(y_val, (val_probs >= thresh).astype(int), zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh
    print(f"Validation tuned decision threshold: {best_thresh:.2f} (Val F1: {best_f1:.3f})")

    # 6. Evaluate strictly on held-out test split using calibrated probabilities
    test_probs = calibrator.predict_proba(X_test)[:, 1]
    raw_test_probs = base_model.predict_proba(X_test)[:, 1]
    predictions = (test_probs >= best_thresh).astype(int)

    auroc = float(roc_auc_score(y_test, test_probs))
    # Stratified patient-level bootstrap: resample each holdout class independently
    # so every replicate contains both classes and estimates AUROC uncertainty.
    positive_indices = np.flatnonzero(y_test.to_numpy() == 1)
    negative_indices = np.flatnonzero(y_test.to_numpy() == 0)
    rng = np.random.default_rng(42)
    bootstrap_aurocs = []
    for _ in range(2000):
        sampled = np.concatenate([
            rng.choice(negative_indices, size=len(negative_indices), replace=True),
            rng.choice(positive_indices, size=len(positive_indices), replace=True),
        ])
        bootstrap_aurocs.append(roc_auc_score(y_test.to_numpy()[sampled], test_probs[sampled]))
    auroc_ci95 = np.quantile(bootstrap_aurocs, [0.025, 0.975]).tolist()
    average_precision = float(average_precision_score(y_test, test_probs))
    brier = float(brier_score_loss(y_test, test_probs))
    raw_brier = float(brier_score_loss(y_test, raw_test_probs))
    tn, fp, fn, tp = confusion_matrix(y_test, predictions, labels=[0, 1]).ravel()

    print("\n--- Test Set Holdout Evaluation ---")
    print(f"AUROC: {auroc:.4f}")
    print(f"Average Precision: {average_precision:.4f} (baseline prevalence: {y_test.mean():.4f})")
    print(f"Brier Score (Calibrated): {brier:.4f} vs Raw: {raw_brier:.4f}")
    print(f"Confusion Matrix (at tuned thresh {best_thresh:.2f}): TP={tp}, FP={fp}, TN={tn}, FN={fn}")
    print(classification_report(y_test, predictions, zero_division=0))

    if auroc > 0.90:
        print("WARNING: AUROC > 0.90 detected. Reviewing for potential feature leakage.")
    else:
        print(f"AUROC ({auroc:.4f}) <= 0.90: Realistic benchmark performance.")

    # 7. Save model artifacts
    model_path = os.path.join(args.model_dir, "sepsis_model.json")
    base_model.save_model(model_path)

    # Save calibrator lr model
    calibrator_path = os.path.join(args.model_dir, "calibrator.joblib")
    joblib.dump(lr, calibrator_path)

    # Save feature names
    features_out_path = os.path.join(args.model_dir, "features.json")
    with open(features_out_path, "w") as f:
        json.dump(feature_names, f, indent=2)

    # Write metrics.json with all required fields
    metrics_data = {
        "dataset": "PhysioNet/CinC Challenge 2019 (random subset of sets A+B)",
        "n_patients_used": int(len(df)),
        "positives": int(y.sum()),
        "n_train": int(len(X_train) + len(X_val)),
        "n_test": int(len(X_test)),
        "test_positive_count": int(y_test.sum()),
        "positive_rate": round(float(y.mean()), 4),
        "test_positive_rate": round(float(y_test.mean()), 4),
        "AUROC": round(auroc, 4),
        "auroc": round(auroc, 4),
        "auroc_ci95": [round(float(auroc_ci95[0]), 4), round(float(auroc_ci95[1]), 4)],
        "average_precision": round(average_precision, 4),
        "brier_score": round(brier, 4),
        "threshold": round(float(best_thresh), 2),
        "confusion_counts": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
        "date": datetime.datetime.now().strftime("%Y-%m-%d"),
        "feature_list": feature_names,
        "features": feature_names,
        "calibration": "sigmoid (Platt scaling)",
    }

    metrics_path = os.path.join(args.model_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)

    print(f"\nArtifacts successfully written:")
    print(f"  Model: {model_path}")
    print(f"  Calibrator: {calibrator_path}")
    print(f"  Metrics: {metrics_path}")


if __name__ == "__main__":
    main()
