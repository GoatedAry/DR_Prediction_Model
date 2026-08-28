"""
Model definitions (PRD §24-26): a soft-voting / probability-stacking
ensemble of three small, heavily regularized models — NOT a large
end-to-end deep net (PRD §2).

    Model A - Elastic-Net regularized multinomial logistic regression
    Model B - Gradient-boosted trees (XGBoost if available)
    Model C - A second, structurally different nonlinear model
              (LightGBM if available)

This sandbox has no internet access, so xgboost/lightgbm are not
installed here. The code below tries to import them and transparently
falls back to close sklearn equivalents so the *pipeline still runs
end-to-end on real data*:

    XGBoost  -> sklearn.HistGradientBoostingClassifier (also boosting,
                also handles regularization/early-stopping-style controls)
    LightGBM -> sklearn.ExtraTreesClassifier (bagging-based, structurally
                different from boosting -> preserves ensemble diversity,
                which is the actual point of having a "Model C")

In an environment with xgboost/lightgbm installed, this module will use
them automatically — no code changes needed elsewhere.

XGBoost >=2.0 removed automatic string-label encoding and requires
integer class labels (0..n_classes-1), while the rest of this codebase
uses the string labels "Healthy"/"Pre-T2D"/"T2D" throughout (evaluation,
calibration, the LLM layer, etc. all key off those strings). Rather than
touch every caller, `SafeLabelClassifier` below wraps XGBoost (and,
defensively, LightGBM) so they present the same string-label interface
as every other estimator in the pipeline -- encoding happens only at
this one boundary.
"""
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier, ExtraTreesClassifier
from sklearn.preprocessing import LabelEncoder

from config.config import RANDOM_SEED

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False


class SafeLabelClassifier(BaseEstimator, ClassifierMixin):
    """Wraps a classifier that requires integer-encoded class labels
    (e.g. XGBoost >=2.0) so it can be dropped into a pipeline that uses
    string class labels throughout. Encodes on fit, decodes on predict;
    predict_proba's column order is exposed via self.classes_ so callers
    that realign columns against CLASS_NAMES (see experiments/run_ablation.py)
    continue to work unchanged."""

    def __init__(self, estimator):
        self.estimator = estimator

    def fit(self, X, y):
        self.label_encoder_ = LabelEncoder().fit(y)
        y_enc = self.label_encoder_.transform(y)
        self.estimator_ = clone(self.estimator).fit(X, y_enc)
        self.classes_ = self.label_encoder_.classes_
        return self

    def predict_proba(self, X):
        return self.estimator_.predict_proba(X)

    def predict(self, X):
        pred_enc = self.estimator_.predict(X)
        return self.label_encoder_.inverse_transform(pred_enc)


def make_model_a(n_features: int) -> LogisticRegression:
    """Elastic-Net regularized multinomial logistic regression — the robust,
    interpretable, low-variance baseline (PRD §24 Model A)."""
    # C is small (strong regularization) given N~45; l1_ratio blends L1/L2.
    return LogisticRegression(
        penalty="elasticnet", solver="saga", l1_ratio=0.5, C=0.3,
        max_iter=5000, random_state=RANDOM_SEED,
    )


def make_model_b(n_estimators: int = 100):
    """PRD §24 Model B - heavily regularized gradient boosting."""
    if HAS_XGBOOST:
        xgb = XGBClassifier(
            max_depth=3, learning_rate=0.05, n_estimators=n_estimators,
            subsample=0.7, colsample_bytree=0.7, min_child_weight=3,
            reg_alpha=0.5, reg_lambda=2.0, objective="multi:softprob",
            eval_metric="mlogloss", random_state=RANDOM_SEED, n_jobs=-1,
        )
        return SafeLabelClassifier(xgb)
    # Fallback: sklearn's own boosting implementation, same regularization intent
    return HistGradientBoostingClassifier(
        max_depth=3, learning_rate=0.05, max_iter=n_estimators,
        l2_regularization=2.0, min_samples_leaf=5,
        random_state=RANDOM_SEED,
    )


def make_model_c(n_estimators: int = 200):
    """PRD §24 Model C - a second, constrained nonlinear model."""
    if HAS_LIGHTGBM:
        lgbm = LGBMClassifier(
            max_depth=3, num_leaves=7, learning_rate=0.05, n_estimators=n_estimators,
            subsample=0.7, colsample_bytree=0.7, min_child_samples=5,
            reg_alpha=0.5, reg_lambda=2.0, random_state=RANDOM_SEED, verbosity=-1,
        )
        return SafeLabelClassifier(lgbm)  # defensive: LightGBM handles string
                                           # labels natively in most versions,
                                           # but wrapping costs nothing and
                                           # removes any version-dependent risk
    # Fallback: Extra-Trees — bagging-based (vs. Model B's boosting), so the
    # ensemble still combines two structurally different error profiles.
    return ExtraTreesClassifier(
        n_estimators=n_estimators, max_depth=4, min_samples_leaf=3,
        max_features="sqrt", random_state=RANDOM_SEED, n_jobs=-1,
    )


def model_backend_report() -> dict:
    return {
        "model_b_backend": "XGBoost" if HAS_XGBOOST else "HistGradientBoostingClassifier (fallback)",
        "model_c_backend": "LightGBM" if HAS_LIGHTGBM else "ExtraTreesClassifier (fallback)",
    }
