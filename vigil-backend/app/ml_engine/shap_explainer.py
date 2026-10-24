from app.ml_engine.model_loader import model, calibrator, FEATURE_NAMES

_explainer = None


def _get_explainer():
    global _explainer
    if _explainer is None:
        import shap
        _explainer = shap.TreeExplainer(model)
    return _explainer


def get_risk_and_explanation(feature_vector: list[float]):
    """
    feature_vector must be in the exact order of FEATURE_NAMES.
    Returns (risk_probability, contributions) where contributions is a
    list of dicts sorted by absolute SHAP impact, largest first.
    Uses calibrated probability (Platt sigmoid) if available.
    SHAP values always explain the underlying XGBoost tree model.
    """
    if len(feature_vector) != len(FEATURE_NAMES):
        raise ValueError(
            f"Expected {len(FEATURE_NAMES)} features ({FEATURE_NAMES}), "
            f"got {len(feature_vector)}."
        )

    # Calculate calibrated probability if calibrator exists; otherwise raw XGBoost proba
    if calibrator is not None:
        margin = model.predict([feature_vector], output_margin=True).reshape(-1, 1)
        risk_prob = float(calibrator.predict_proba(margin)[0][1])
    else:
        risk_prob = float(model.predict_proba([feature_vector])[0][1])

    explainer = _get_explainer()
    shap_values = explainer.shap_values([feature_vector])[0]

    contributions = [
        {
            "feature": name,
            "value": round(float(val), 2),
            "shap_impact": round(float(shap_val), 4),
            "direction": "increases_risk" if shap_val > 0 else "decreases_risk",
        }
        for name, val, shap_val in zip(FEATURE_NAMES, feature_vector, shap_values)
    ]
    contributions.sort(key=lambda c: abs(c["shap_impact"]), reverse=True)

    return risk_prob, contributions
