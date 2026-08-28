"""
Assembles the full participant-level dataset (PRD §29 multimodal fusion):

    Clinical vector + Temporal (CGM/HR/activity) vector + Nutrition vector
    -> one row per participant, with a `label` column and a `data_quality_score`.

Also tags each feature column with which modality it belongs to
(clinical / cgm / meal / activity) so ablation experiments (PRD §47) can
select subsets without recomputing anything.
"""
import glob
import re
from pathlib import Path

import pandas as pd

from config.config import DATA_ROOT, ARTIFACT_DIR
from preprocessing.labeling import load_bio_with_labels
from preprocessing.cgm_cleaning import clean_participant_cgm
from features.cgm_features import build_cgm_feature_vector
from features.postprandial import build_postprandial_feature_vector
from features.activity import build_activity_feature_vector, build_post_meal_activity_features

CLINICAL_COLS = ["age", "gender", "bmi", "hba1c", "fasting_glucose", "fasting_insulin",
                  "triglycerides", "total_cholesterol", "hdl", "ldl", "vldl", "chol_hdl_ratio"]


def _participant_file_map() -> dict:
    files = sorted(glob.glob(str(DATA_ROOT / "CGMacros-*" / "CGMacros-*.csv")))
    out = {}
    for f in files:
        m = re.search(r"CGMacros-(\d+)\.csv$", f)
        if m:
            out[int(m.group(1))] = f
    return out


def build_participant_row(participant_id: int, csv_path: str) -> dict:
    raw = pd.read_csv(csv_path)
    cleaned = clean_participant_cgm(raw)
    df = cleaned.df

    row = {"participant_id": participant_id, "data_quality_score": cleaned.quality_score,
           "valid_cgm_hours": cleaned.valid_hours,
           "cgm_coverage_fraction": cleaned.quality_report["coverage_fraction"],
           "meets_min_cgm_duration": cleaned.quality_report["meets_min_duration"]}

    row.update(build_cgm_feature_vector(df, sample_interval_min=1, glucose_col="Libre GL"))
    row.update(build_postprandial_feature_vector(df, glucose_col="Libre GL"))
    row.update(build_activity_feature_vector(df))
    row.update(build_post_meal_activity_features(df))
    return row


def build_full_dataset(save_path: str = None) -> pd.DataFrame:
    bio = load_bio_with_labels()
    file_map = _participant_file_map()

    rows = []
    for pid in sorted(file_map):
        try:
            rows.append(build_participant_row(pid, file_map[pid]))
        except Exception as e:  # keep going, surface which participant failed
            print(f"[warn] participant {pid} failed feature extraction: {e}")

    temporal_df = pd.DataFrame(rows)
    full = bio.merge(temporal_df, on="participant_id", how="inner")
    full = full.dropna(subset=["label"])  # PRD §12: never fabricate labels

    # encode categorical clinical field
    if "gender" in full.columns:
        full["gender_male"] = (full["gender"] == "M").astype(int)
        full = full.drop(columns=["gender"])

    if save_path:
        full.to_csv(save_path, index=False)
    return full


def get_modality_columns(df: pd.DataFrame) -> dict:
    cols = [c for c in df.columns if c not in ("participant_id", "label")]
    clinical = [c for c in cols if c in CLINICAL_COLS or c == "gender_male"]
    # NOTE: `label` is derived deterministically from hba1c via ADA thresholds
    # (preprocessing/labeling.py). Including hba1c as a predictor therefore
    # makes "clinical" trivially ~100% by construction, not by genuine
    # generalization -- that's a definitional leak, not model leakage across
    # folds. `clinical_no_a1c` is the scientifically meaningful clinical
    # baseline: what you'd have from biomarkers *without already knowing*
    # the label-defining value.
    clinical_no_a1c = [c for c in clinical if c != "hba1c"]
    cgm = [c for c in cols if c.startswith("glc_") or c in
           ("data_quality_score", "valid_cgm_hours", "cgm_coverage_fraction")]
    meal = [c for c in cols if c.startswith("meal_")]
    activity = [c for c in cols if c.startswith(("hr_", "resting_hr", "activity_", "mets_",
                                                   "active_minutes", "post_meal_"))]
    return {"clinical": clinical, "clinical_no_a1c": clinical_no_a1c,
            "cgm": cgm, "meal": meal, "activity": activity}


if __name__ == "__main__":
    df = build_full_dataset(save_path=str(ARTIFACT_DIR / "participant_features.csv"))
    print(df.shape)
    print(df["label"].value_counts())
    mods = get_modality_columns(df)
    for k, v in mods.items():
        print(k, len(v))
