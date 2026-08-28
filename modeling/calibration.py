"""
Calibration (PRD §36): wraps the ensemble so that Platt scaling / isotonic
regression is fit ONLY on the training fold, never on validation/test data.

At N~45 with 3 classes, per-fold training partitions are small (~28-32
samples with a 5-fold split), so isotonic regression (which has more
degrees of freedom) is prone to overfitting the calibration curve itself.
We therefore default to Platt scaling (sigmoid) here and only offer
isotonic as an option for use with larger external validation sets.
"""
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold

from config.config import CLASS_NAMES, RANDOM_SEED


class CalibratedEnsemble(BaseEstimator, ClassifierMixin):
    """Fits the base ensemble on a training split, then fits one
    per-class Platt-scaling (1-D logistic regression) calibrator on
    out-of-fold probabilities from an inner CV loop on that same training
    split -- so the calibrator never sees the data it's evaluated on
    downstream, and the base ensemble is never calibrated on its own
    training predictions (which would be overconfident)."""

    def __init__(self, base_estimator, method: str = "sigmoid", inner_splits: int = 3):
        self.base_estimator = base_estimator
        self.method = method
        self.inner_splits = inner_splits

    def fit(self, X, y):
        self.classes_ = np.array(CLASS_NAMES)
        X = np.asarray(X)
        y = np.asarray(y)

        # 1. Inner CV to get honest out-of-fold probabilities for calibrator fitting
        skf = StratifiedKFold(n_splits=min(self.inner_splits, min(np.bincount(
            np.searchsorted(np.unique(y), y)))), shuffle=True, random_state=RANDOM_SEED)
        oof_proba = np.zeros((len(y), len(self.classes_)))
        for tr, va in skf.split(X, y):
            est = clone(self.base_estimator)
            est.fit(X[tr], y[tr])
            proba = est.predict_proba(X[va])
            classes_ = list(getattr(est, "classes_", self.classes_))
            col_idx = [classes_.index(c) for c in self.classes_]
            oof_proba[va] = proba[:, col_idx]

        # 2. Fit one 1-D Platt calibrator per class on the OOF probabilities
        self.calibrators_ = []
        for i, c in enumerate(self.classes_):
            y_bin = (y == c).astype(int)
            lr = LogisticRegression(random_state=RANDOM_SEED)
            lr.fit(oof_proba[:, i].reshape(-1, 1), y_bin)
            self.calibrators_.append(lr)

        # 3. Refit the base estimator on ALL of the training split for final use
        self.final_estimator_ = clone(self.base_estimator).fit(X, y)
        return self

    def predict_proba(self, X):
        X = np.asarray(X)
        raw = self.final_estimator_.predict_proba(X)
        classes_ = list(getattr(self.final_estimator_, "classes_", self.classes_))
        col_idx = [classes_.index(c) for c in self.classes_]
        raw = raw[:, col_idx]

        calibrated = np.column_stack([
            self.calibrators_[i].predict_proba(raw[:, i].reshape(-1, 1))[:, 1]
            for i in range(len(self.classes_))
        ])
        # renormalize so probabilities sum to 1 across classes
        calibrated = calibrated / calibrated.sum(axis=1, keepdims=True)
        return calibrated

    def predict(self, X):
        proba = self.predict_proba(X)
        return self.classes_[np.argmax(proba, axis=1)]
