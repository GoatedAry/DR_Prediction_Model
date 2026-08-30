"""
Participant-level labeling (PRD §12).

Labels are derived from HbA1c using standard ADA diagnostic thresholds —
this is a recognized clinical convention, not an invented cutoff:

    A1c < 5.7%        -> Healthy
    5.7% <= A1c < 6.5% -> Pre-T2D
    A1c >= 6.5%        -> T2D

Fasting glucose is kept alongside as a secondary clinical feature (and could
be used to cross-check borderline A1c cases), but A1c is the primary label
source since it is available and complete for all 45 participants.
"""
import pandas as pd
from config.config import BIO_CSV, A1C_HEALTHY_MAX, A1C_PREDIABETES_MAX


def label_from_a1c(a1c: float) -> str:
    if pd.isna(a1c):
        return None
    if a1c < A1C_HEALTHY_MAX:
        return "Healthy"
    if a1c < A1C_PREDIABETES_MAX:
        return "Pre-T2D"
    return "T2D"


def load_bio_with_labels() -> pd.DataFrame:
    """Load bio.csv, clean column names, attach the classification label."""
    bio = pd.read_csv(BIO_CSV)
    bio.columns = [c.strip() for c in bio.columns]

    rename_map = {
        "subject": "participant_id",
        "Age": "age",
        "Gender": "gender",
        "BMI": "bmi",
        "Body weight": "body_weight_lb",
        "Height": "height_in",
        "Self-identify": "self_identified_ethnicity",
        "A1c PDL (Lab)": "hba1c",
        "Fasting GLU - PDL (Lab)": "fasting_glucose",
        "Insulin": "fasting_insulin",
        "Triglycerides": "triglycerides",
        "Cholesterol": "total_cholesterol",
        "HDL": "hdl",
        "Non HDL": "non_hdl",
        "LDL (Cal)": "ldl",
        "VLDL (Cal)": "vldl",
        "Cho/HDL Ratio": "chol_hdl_ratio",
    }
    bio = bio.rename(columns={k: v for k, v in rename_map.items() if k in bio.columns})
    bio["label"] = bio["hba1c"].apply(label_from_a1c)
    keep = ["participant_id", "age", "gender", "bmi", "body_weight_lb", "height_in",
            "hba1c", "fasting_glucose", "fasting_insulin", "triglycerides",
            "total_cholesterol", "hdl", "ldl", "vldl", "chol_hdl_ratio", "label"]
    keep = [c for c in keep if c in bio.columns]
    return bio[keep]


if __name__ == "__main__":
    df = load_bio_with_labels()
    print(df["label"].value_counts())
    print(df.head())
