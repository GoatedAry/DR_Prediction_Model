"""
Trains the final production ensemble on ALL 45 participants (no held-out
split -- this is the deployed model, not an evaluation run; generalization
was already estimated honestly via grouped-CV/LOPO in experiments/main.py)
and saves everything needed to reproduce an inference result later
(PRD §55): model, feature list, hyperparameters, train participant IDs,
dataset version, and a timestamped experiment record (PRD §56).
"""
import sys, json, hashlib, time, warnings
sys.path.insert(0, ".")
warnings.filterwarnings("ignore")

import joblib
import pandas as pd

from config.config import ARTIFACT_DIR, RESULTS_DIR, RANDOM_SEED
from preprocessing.build_dataset import build_full_dataset, get_modality_columns
from modeling.pipeline import make_feature_pipeline, SoftVotingEnsemble
from modeling.models import make_model_a, make_model_b, make_model_c, model_backend_report


def _dataset_hash(df: pd.DataFrame) -> str:
    return hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values).hexdigest()[:16]


def train_and_save_final_model():
    df = build_full_dataset(save_path=str(ARTIFACT_DIR / "participant_features.csv"))
    mods = get_modality_columns(df)
    feature_cols = mods["clinical_no_a1c"] + mods["cgm"] + mods["activity"] + mods["meal"]

    X = df[feature_cols].to_numpy(dtype=float)
    y = df["label"].to_numpy()
    k_features = 15

    ensemble = SoftVotingEnsemble([
        ("logreg_elasticnet", make_feature_pipeline(make_model_a(len(feature_cols)), k_features=k_features)),
        ("model_b", make_feature_pipeline(make_model_b(), k_features=k_features)),
        ("model_c", make_feature_pipeline(make_model_c(), k_features=k_features)),
    ])
    ensemble.fit(X, y)

    joblib.dump(ensemble, ARTIFACT_DIR / "final_ensemble.joblib")

    manifest = {
        "model_version": "v1.0.0",
        "trained_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset_version": "cgmacros-1.0.0",
        "dataset_hash": _dataset_hash(df[feature_cols + ["label", "participant_id"]]),
        "n_participants": len(df),
        "class_distribution": df["label"].value_counts().to_dict(),
        "feature_columns": feature_cols,
        "k_features_selected_per_model": k_features,
        "random_seed": RANDOM_SEED,
        "train_participant_ids": sorted(df["participant_id"].tolist()),
        "model_backends": model_backend_report(),
        "hyperparameters": {
            "model_a": "ElasticNet LogisticRegression(C=0.3, l1_ratio=0.5)",
            "model_b": "max_depth=3, learning_rate=0.05, reg_lambda=2.0",
            "model_c": "max_depth=3-4, regularized",
        },
        "note": ("This is the FINAL model fit on all available participants for "
                 "deployment. Generalization estimates (macro AUROC, F1, LOPO, etc.) "
                 "come from the separate grouped-CV runs in experiments/main.py / "
                 "results/, never from this fit."),
    }
    with open(ARTIFACT_DIR / "model_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    print("Saved:", ARTIFACT_DIR / "final_ensemble.joblib")
    print("Saved:", ARTIFACT_DIR / "model_manifest.json")
    return ensemble, manifest


if __name__ == "__main__":
    train_and_save_final_model()
