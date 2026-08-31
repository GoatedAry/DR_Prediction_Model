"""
Metrics (PRD §35): never accuracy alone. Computed here from out-of-fold
predictions collected across a full grouped-CV run, so every number
reflects held-out, participant-disjoint performance.
"""
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, f1_score, balanced_accuracy_score, precision_score,
    recall_score, confusion_matrix, brier_score_loss,
)
from sklearn.preprocessing import label_binarize

from config.config import CLASS_NAMES


def per_class_sensitivity_specificity(y_true, y_pred, classes=CLASS_NAMES):
    cm = confusion_matrix(y_true, y_pred, labels=classes)
    out = {}
    total = cm.sum()
    for i, c in enumerate(classes):
        tp = cm[i, i]
        fn = cm[i, :].sum() - tp
        fp = cm[:, i].sum() - tp
        tn = total - tp - fn - fp
        out[c] = {
            "sensitivity_recall": tp / (tp + fn) if (tp + fn) else np.nan,
            "specificity": tn / (tn + fp) if (tn + fp) else np.nan,
        }
    return out, cm


def expected_calibration_error(y_true_bin, y_prob, n_bins=10):
    """ECE computed over the flattened one-vs-rest probabilities (multiclass
    generalization of the standard binary ECE)."""
    y_true_bin = np.asarray(y_true_bin).ravel()
    y_prob = np.asarray(y_prob).ravel()
    bins = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n = len(y_prob)
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        mask = (y_prob >= lo) & (y_prob < hi if i < n_bins - 1 else y_prob <= hi)
        if mask.sum() == 0:
            continue
        acc = y_true_bin[mask].mean()
        conf = y_prob[mask].mean()
        ece += (mask.sum() / n) * abs(acc - conf)
    return ece


def evaluate(y_true, y_pred, y_proba, classes=CLASS_NAMES) -> dict:
    y_true_bin = label_binarize(y_true, classes=classes)

    results = {
        "macro_auroc": roc_auc_score(y_true_bin, y_proba, multi_class="ovr", average="macro"),
        "macro_f1": f1_score(y_true, y_pred, labels=classes, average="macro"),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "macro_precision": precision_score(y_true, y_pred, labels=classes, average="macro", zero_division=0),
        "macro_recall": recall_score(y_true, y_pred, labels=classes, average="macro", zero_division=0),
        "brier_score": np.mean([
            brier_score_loss(y_true_bin[:, i], y_proba[:, i]) for i in range(len(classes))
        ]),
        "expected_calibration_error": expected_calibration_error(y_true_bin, y_proba),
    }
    per_class, cm = per_class_sensitivity_specificity(y_true, y_pred, classes)
    results["per_class"] = per_class
    results["confusion_matrix"] = pd.DataFrame(cm, index=classes, columns=classes)
    return results


def format_report(results: dict, title: str = "") -> str:
    lines = [f"=== {title} ===" if title else "=== Results ==="]
    for k in ["macro_auroc", "macro_f1", "balanced_accuracy", "macro_precision",
              "macro_recall", "brier_score", "expected_calibration_error"]:
        lines.append(f"{k:28s}: {results[k]:.3f}")
    lines.append("\nPer-class sensitivity / specificity:")
    for c, v in results["per_class"].items():
        lines.append(f"  {c:10s} sens={v['sensitivity_recall']:.3f}  spec={v['specificity']:.3f}")
    lines.append("\nConfusion matrix (rows=true, cols=pred):")
    lines.append(results["confusion_matrix"].to_string())
    return "\n".join(lines)
