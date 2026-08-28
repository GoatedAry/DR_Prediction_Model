"""
End-to-end smoke test for the inference pipeline (api/inference.py), using
one real participant's raw CGMacros CSV as if it were a brand-new user
submission. Demonstrates PRD §54: raw CGM/meal file + clinical row -> final
structured assessment, using the SAME model artifacts trained in
modeling/train_final.py.
"""
import sys
sys.path.insert(0, ".")
import json
import warnings
warnings.filterwarnings("ignore")

from preprocessing.labeling import load_bio_with_labels
from api.inference import run_inference
from config.config import DATA_ROOT


def main(participant_id: int = 5):
    bio = load_bio_with_labels()
    row = bio[bio["participant_id"] == participant_id].iloc[0].to_dict()
    true_label = row.pop("label")
    csv_path = DATA_ROOT / f"CGMacros-{participant_id:03d}" / f"CGMacros-{participant_id:03d}.csv"

    result = run_inference(str(csv_path), row)
    print(f"Participant {participant_id} -- TRUE LABEL (via ADA A1c criteria): {true_label}")
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
