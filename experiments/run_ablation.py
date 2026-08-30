"""
Runs the pipeline under grouped (participant-level) cross-validation and
reproduces the PRD's required experiments:

  §47 Ablation:   Exp1 clinical-only, Exp2 CGM-only, Exp3 clinical+CGM,
                  Exp4 +activity/HR, Exp5 +meals (full multimodal)
  §49 Baselines:  majority class, plain LR, Random Forest, boosted trees,
                  second nonlinear model, final ensemble — same splits.

Every number reported is computed from OUT-OF-FOLD predictions only
(a participant's prediction always comes from a fold where their data
was held out), so this is a genuine estimate of generalization to unseen
participants, not training performance (PRD §2, §61).
"""
import warnings
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier

from config.config import RANDOM_SEED, N_CV_FOLDS, CLASS_NAMES
from modeling.splits import stratified_group_kfold_splits
from modeling.pipeline import make_feature_pipeline, SoftVotingEnsemble
from modeling.models import make_model_a, make_model_b, make_model_c
from modeling.evaluation import evaluate

warnings.filterwarnings("ignore")


def _build_estimator(model_type: str, n_features: int, k_features: int):
    k = min(k_features, max(n_features, 1))
    if model_type == "majority":
        return DummyClassifier(strategy="prior", random_state=RANDOM_SEED)
    if model_type == "logistic":
        return make_feature_pipeline(make_model_a(n_features), k_features=k)
    if model_type == "random_forest":
        rf = RandomForestClassifier(n_estimators=200, max_depth=4, min_samples_leaf=3,
                                     max_features="sqrt", random_state=RANDOM_SEED)
        return make_feature_pipeline(rf, k_features=k)
    if model_type == "boosted_b":
        return make_feature_pipeline(make_model_b(), k_features=k)
    if model_type == "boosted_c":
        return make_feature_pipeline(make_model_c(), k_features=k)
    if model_type == "ensemble":
        return SoftVotingEnsemble([
            ("logreg_elasticnet", make_feature_pipeline(make_model_a(n_features), k_features=k)),
            ("model_b", make_feature_pipeline(make_model_b(), k_features=k)),
            ("model_c", make_feature_pipeline(make_model_c(), k_features=k)),
        ])
    raise ValueError(model_type)


def run_cv_experiment(df: pd.DataFrame, feature_cols: list, model_type: str = "ensemble",
                       n_splits: int = N_CV_FOLDS, k_features: int = 15, seed: int = RANDOM_SEED):
    X = df[feature_cols].to_numpy(dtype=float)
    y = df["label"].to_numpy()
    groups = df["participant_id"].to_numpy()

    n = len(y)
    oof_proba = np.zeros((n, len(CLASS_NAMES)))
    oof_pred = np.empty(n, dtype=object)
    fold_metrics = []

    for fold_i, (tr, va) in enumerate(stratified_group_kfold_splits(X, y, groups, n_splits=n_splits, seed=seed)):
        est = _build_estimator(model_type, X.shape[1], k_features)
        est.fit(X[tr], y[tr])
        proba = est.predict_proba(X[va])
        # align column order to CLASS_NAMES regardless of internal class ordering
        classes_ = list(getattr(est, "classes_", CLASS_NAMES))
        col_idx = [classes_.index(c) for c in CLASS_NAMES]
        proba = proba[:, col_idx]
        pred = np.array(CLASS_NAMES)[np.argmax(proba, axis=1)]

        oof_proba[va] = proba
        oof_pred[va] = pred

        fold_result = evaluate(y[va], pred, proba)
        fold_metrics.append({k: v for k, v in fold_result.items()
                              if k not in ("per_class", "confusion_matrix")})

    overall = evaluate(y, oof_pred, oof_proba)
    fold_df = pd.DataFrame(fold_metrics)
    overall["fold_mean"] = fold_df.mean(numeric_only=True).to_dict()
    overall["fold_std"] = fold_df.std(numeric_only=True).to_dict()
    overall["oof_pred"] = oof_pred
    overall["oof_proba"] = oof_proba
    overall["y_true"] = y
    overall["participant_id"] = groups
    return overall


def run_leave_one_participant_out(df, feature_cols, model_type="ensemble", k_features=15):
    from modeling.splits import leave_one_participant_out_splits
    X = df[feature_cols].to_numpy(dtype=float)
    y = df["label"].to_numpy()
    groups = df["participant_id"].to_numpy()
    n = len(y)
    oof_proba = np.zeros((n, len(CLASS_NAMES)))
    oof_pred = np.empty(n, dtype=object)
    for tr, va in leave_one_participant_out_splits(X, groups):
        est = _build_estimator(model_type, X.shape[1], k_features)
        est.fit(X[tr], y[tr])
        proba = est.predict_proba(X[va])
        classes_ = list(getattr(est, "classes_", CLASS_NAMES))
        col_idx = [classes_.index(c) for c in CLASS_NAMES]
        proba = proba[:, col_idx]
        oof_proba[va] = proba
        oof_pred[va] = np.array(CLASS_NAMES)[np.argmax(proba, axis=1)]
    return evaluate(y, oof_pred, oof_proba)
