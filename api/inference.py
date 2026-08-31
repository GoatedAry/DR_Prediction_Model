"""
Inference pipeline for a single participant's raw CGMacros-format CSV +
bio row (PRD §54). Uses the EXACT SAME preprocessing/feature-extraction
code as training (imports the same modules) -- there is no separate
"inference preprocessing" implementation to drift out of sync.

    User CGM/meal/activity CSV + clinical row
        -> validation
        -> data quality assessment
        -> same cleaning/feature pipeline as training
        -> load saved ensemble (artifacts/final_ensemble.joblib)
        -> probabilities
        -> explainability (SHAP/permutation)
        -> structured JSON
        -> LLM reasoning layer
        -> final assessment (classification + explanation + recommendations)
"""
import sys
sys.path.insert(0, ".")
import json
import warnings

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

from config.config import ARTIFACT_DIR, CLASS_NAMES, MIN_VALID_HOURS_FOR_TEMPORAL_ASSESSMENT
from preprocessing.cgm_cleaning import clean_participant_cgm
from features.cgm_features import build_cgm_feature_vector
from features.postprandial import build_postprandial_feature_vector
from features.activity import build_activity_feature_vector, build_post_meal_activity_features
from modeling.explainability import explain_prediction
from llm.reasoning import explain as llm_explain


def load_model():
    ensemble = joblib.load(ARTIFACT_DIR / "final_ensemble.joblib")
    with open(ARTIFACT_DIR / "model_manifest.json") as f:
        manifest = json.load(f)
    return ensemble, manifest


def extract_features_for_inference(cgm_csv_path: str, clinical_row: dict) -> dict:
    """Runs the identical feature-extraction path used in
    preprocessing/build_dataset.py::build_participant_row, minus the
    training-set merge -- so production and training features cannot drift
    apart. `clinical_row` should have the same keys as bio.csv columns
    after preprocessing.labeling's rename (age, bmi, hba1c, ... )."""
    raw = pd.read_csv(cgm_csv_path)
    cleaned = clean_participant_cgm(raw)
    df = cleaned.df

    feats = dict(clinical_row)
    feats["data_quality_score"] = cleaned.quality_score
    feats["valid_cgm_hours"] = cleaned.valid_hours
    feats["cgm_coverage_fraction"] = cleaned.quality_report["coverage_fraction"]
    feats["meets_min_cgm_duration"] = cleaned.quality_report["meets_min_duration"]

    feats.update(build_cgm_feature_vector(df, sample_interval_min=1, glucose_col="Libre GL"))
    feats.update(build_postprandial_feature_vector(df, glucose_col="Libre GL"))
    feats.update(build_activity_feature_vector(df))
    feats.update(build_post_meal_activity_features(df))

    if "gender" in feats:
        feats["gender_male"] = 1 if feats["gender"] == "M" else 0

    feats["insufficient_data"] = not cleaned.quality_report["meets_min_duration"]
    return feats


def run_inference(cgm_csv_path: str, clinical_row: dict) -> dict:
    ensemble, manifest = load_model()
    feature_cols = manifest["feature_columns"]

    features = extract_features_for_inference(cgm_csv_path, clinical_row)

    # PRD §45: insufficient data handling
    if features["insufficient_data"]:
        return {
            "status": "insufficient_data",
            "message": (
                f"Only {features['valid_cgm_hours']:.1f} hours of valid CGM data were "
                f"available (minimum {MIN_VALID_HOURS_FOR_TEMPORAL_ASSESSMENT}h required), "
                "so long-term variability and overnight patterns could not be reliably assessed."
            ),
            "data_quality": {"score": features["data_quality_score"],
                              "valid_cgm_hours": features["valid_cgm_hours"]},
        }

    X = np.array([[features.get(c, np.nan) for c in feature_cols]], dtype=float)
    proba = ensemble.predict_proba(X)[0]
    classes_ = list(ensemble.classes_)
    probs = {c: float(proba[classes_.index(c)]) for c in CLASS_NAMES}
    model_probs = {"healthy_probability": probs["Healthy"],
                    "prediabetes_probability": probs["Pre-T2D"],
                    "t2d_probability": probs["T2D"]}

    top_p = max(model_probs.values())
    low_confidence = top_p < 0.45  # no class clearly dominant (PRD §44)

    # explainability needs a labeled reference set; use the training set held
    # in artifacts for a meaningful permutation baseline
    train_df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    Xref = train_df[feature_cols]
    yref = train_df["label"].to_numpy()
    top_class = max(model_probs, key=model_probs.get)
    target_class = {"healthy_probability": "Healthy", "prediabetes_probability": "Pre-T2D",
                     "t2d_probability": "T2D"}[top_class]
    important = explain_prediction(ensemble, Xref, yref, target_class=target_class, top_k=5)

    result = llm_explain(participant_id=None, features=features,
                          model_probabilities=model_probs, important_features=important)

    result["status"] = "ok"
    result["low_confidence"] = low_confidence
    if low_confidence:
        result["safety_message"] += (" The model could not confidently distinguish between "
                                      "metabolic states for this profile; additional clinical "
                                      "testing may be particularly appropriate.")
    result["model_version"] = manifest["model_version"]
    result["mode"] = "full_multimodal"
    return result


if __name__ == "__main__":
    print("This module is meant to be imported. See tests/test_inference.py for a runnable example.")
