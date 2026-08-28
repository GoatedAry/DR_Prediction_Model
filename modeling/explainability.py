"""
Explainability (PRD §37): produces the same structured "important_factors"
JSON shape the PRD specifies, so swapping the backend from permutation
importance to SHAP (once you have internet/shap installed) requires no
downstream changes.

This sandbox cannot install `shap` (no internet), so `permutation_importance`
is used as the default backend. If shap is importable, `shap_explain()` is
used automatically by `explain_prediction()`.
"""
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

from config.config import CLASS_NAMES


def _direction_from_correlation(feature_values: np.ndarray, class_indicator: np.ndarray) -> str:
    """Cheap, transparent direction heuristic: does this feature tend to be
    higher when the predicted class is positive? Used only to label
    direction for permutation-importance output (SHAP gives this natively
    via signed shap values)."""
    if len(np.unique(class_indicator)) < 2 or np.std(feature_values) == 0:
        return "unclear"
    corr = np.corrcoef(feature_values, class_indicator)[0, 1]
    if np.isnan(corr):
        return "unclear"
    return "increases_risk" if corr > 0 else "decreases_risk"


def permutation_explain(fitted_estimator, X_val: pd.DataFrame, y_val: np.ndarray,
                         target_class: str, top_k: int = 5, n_repeats: int = 20, seed: int = 42) -> list:
    """Global permutation importance w.r.t. the target class's one-vs-rest
    predicted probability. Works with the SoftVotingEnsemble directly since
    it exposes predict_proba."""
    class_idx = CLASS_NAMES.index(target_class)

    def scorer(estimator, X, y):
        proba = estimator.predict_proba(X)
        y_bin = (y == target_class).astype(int)
        # negative log loss on the target class's probability column
        p = np.clip(proba[:, class_idx], 1e-6, 1 - 1e-6)
        return -np.mean(-(y_bin * np.log(p) + (1 - y_bin) * np.log(1 - p)))

    result = permutation_importance(
        fitted_estimator, X_val.to_numpy(), y_val, scoring=scorer,
        n_repeats=n_repeats, random_state=seed,
    )
    importances = result.importances_mean
    order = np.argsort(importances)[::-1][:top_k]

    y_bin = (y_val == target_class).astype(int)
    out = []
    for i in order:
        if importances[i] <= 0:
            continue
        fname = X_val.columns[i]
        direction = _direction_from_correlation(X_val.iloc[:, i].to_numpy(), y_bin)
        out.append({
            "feature": fname,
            "direction": direction,
            "importance": round(float(importances[i]), 4),
        })
    return out


def shap_explain(fitted_pipelines, X_val: pd.DataFrame, target_class: str, top_k: int = 5) -> list:
    """SHAP-based explanation, used automatically when shap is installed.
    Runs a KernelExplainer-free TreeExplainer on the boosted-tree member of
    the ensemble (Model B) since it's the most SHAP-friendly component."""
    class_idx = CLASS_NAMES.index(target_class)
    tree_pipeline = dict(fitted_pipelines)["model_b"]
    clf = tree_pipeline.named_steps["clf"]
    # Model B may be wrapped in SafeLabelClassifier (modeling/models.py) to
    # handle XGBoost >=2.0's integer-label requirement -- unwrap to the real
    # tree model for TreeExplainer, which needs the underlying booster.
    tree_model = getattr(clf, "estimator_", clf)
    X_sel = tree_pipeline.named_steps["select"].transform(
        tree_pipeline.named_steps["scale"].transform(
            tree_pipeline.named_steps["impute"].transform(X_val.to_numpy())))
    feat_names = X_val.columns[tree_pipeline.named_steps["select"].get_support()]

    explainer = shap.TreeExplainer(tree_model)
    shap_values = explainer.shap_values(X_sel)
    if isinstance(shap_values, list):
        vals = shap_values[class_idx]
    else:
        vals = shap_values[..., class_idx]
    mean_abs = np.abs(vals).mean(axis=0)
    order = np.argsort(mean_abs)[::-1][:top_k]

    out = []
    for i in order:
        direction = "increases_risk" if vals[:, i].mean() > 0 else "decreases_risk"
        out.append({
            "feature": feat_names[i],
            "direction": direction,
            "importance": round(float(mean_abs[i]), 4),
        })
    return out


def explain_prediction(fitted_estimator, X_val: pd.DataFrame, y_val: np.ndarray,
                        target_class: str, top_k: int = 5) -> list:
    if HAS_SHAP and hasattr(fitted_estimator, "fitted_"):
        try:
            return shap_explain(fitted_estimator.fitted_, X_val, target_class, top_k)
        except Exception:
            pass  # fall through to permutation importance
    return permutation_explain(fitted_estimator, X_val, y_val, target_class, top_k)
