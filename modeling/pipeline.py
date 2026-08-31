"""
Per-model preprocessing pipeline and the probability-averaging ensemble
(PRD §25, §30, §31): imputation, scaling, and feature selection are all
`sklearn.Pipeline` steps, so when `.fit(X_train)` is called inside a CV fold,
every one of those steps is fit ONLY on that fold's training data — never on
validation/test rows, and never on the full dataset before splitting.
"""
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import SelectKBest, mutual_info_classif

from config.config import RANDOM_SEED


def _mutual_info_score(X, y):
    """Top-level (picklable) wrapper around mutual_info_classif."""
    return mutual_info_classif(X, y, random_state=RANDOM_SEED)


def make_feature_pipeline(clf, k_features: int = 15) -> Pipeline:
    """Impute (median) -> Scale -> Select top-k features by mutual
    information -> classifier. All steps are refit per call to .fit()."""
    return Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("select", SelectKBest(score_func=_mutual_info_score, k=k_features)),
        ("clf", clf),
    ])


class SoftVotingEnsemble(BaseEstimator, ClassifierMixin):
    """Averages predicted class probabilities across a list of fitted
    pipelines (PRD §25: 'Average/stack probabilities. Do not simply
    majority-vote class labels.')."""

    def __init__(self, estimators: list):
        self.estimators = estimators  # list of (name, sklearn Pipeline)

    def fit(self, X, y):
        self.classes_ = np.unique(y)
        self.fitted_ = [(name, clone(est).fit(X, y)) for name, est in self.estimators]
        return self

    def predict_proba(self, X):
        probs = [est.predict_proba(X) for _, est in self.fitted_]
        return np.mean(probs, axis=0)

    def predict(self, X):
        proba = self.predict_proba(X)
        return self.classes_[np.argmax(proba, axis=1)]

    def per_model_proba(self, X):
        return {name: est.predict_proba(X) for name, est in self.fitted_}
