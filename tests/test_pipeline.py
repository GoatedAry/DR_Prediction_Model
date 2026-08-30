"""
Run with: pytest tests/test_pipeline.py -v

Covers the invariants that actually matter for a small-N clinical ML
pipeline: no participant leakage across folds, labels match ADA criteria,
feature extraction doesn't silently produce NaN/inf explosions, and the
saved model round-trips.
"""
import sys
sys.path.insert(0, ".")
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
try:
    import pytest
except ImportError:  # pytest unavailable in this offline sandbox; tests can
    pytest = None    # still be run manually (see __main__ block below)

from preprocessing.labeling import load_bio_with_labels, label_from_a1c
from modeling.splits import stratified_group_kfold_splits, leave_one_participant_out_splits
from config.config import ARTIFACT_DIR


def test_label_thresholds():
    assert label_from_a1c(5.0) == "Healthy"
    assert label_from_a1c(5.69) == "Healthy"
    assert label_from_a1c(5.7) == "Pre-T2D"
    assert label_from_a1c(6.4) == "Pre-T2D"
    assert label_from_a1c(6.5) == "T2D"
    assert label_from_a1c(8.0) == "T2D"
    assert label_from_a1c(float("nan")) is None


def test_bio_labels_present_for_all_participants():
    bio = load_bio_with_labels()
    assert bio["label"].notna().all(), "Every participant should have a derivable label"
    assert set(bio["label"].unique()) <= {"Healthy", "Pre-T2D", "T2D"}


def test_no_participant_leakage_stratified_group_kfold():
    df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    X = df.drop(columns=["participant_id", "label"]).to_numpy(dtype=float)
    y = df["label"].to_numpy()
    groups = df["participant_id"].to_numpy()

    for train_idx, val_idx in stratified_group_kfold_splits(X, y, groups, n_splits=5):
        train_groups = set(groups[train_idx])
        val_groups = set(groups[val_idx])
        assert train_groups.isdisjoint(val_groups), "Participant leaked across train/val!"
        # every class should be represented in training (small-N sanity check)
        assert len(set(y[train_idx])) == len(set(y)), "A class dropped entirely from a training fold"


def test_no_participant_leakage_lopo():
    df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    X = df.drop(columns=["participant_id", "label"]).to_numpy(dtype=float)
    groups = df["participant_id"].to_numpy()
    n_left_out = 0
    for train_idx, val_idx in leave_one_participant_out_splits(X, groups):
        assert len(val_idx) == 1
        assert groups[val_idx[0]] not in set(groups[train_idx])
        n_left_out += 1
    assert n_left_out == df["participant_id"].nunique()


def test_feature_table_has_no_infinite_values():
    df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    numeric = df.select_dtypes(include=[np.number])
    assert not np.isinf(numeric.to_numpy()).any(), "Feature table contains infinite values"


def test_feature_table_missingness_is_bounded():
    """Some NaNs are expected (e.g. a participant with few clean single-meal
    events) but a feature that's entirely NaN across all participants would
    indicate a bug, not real missingness."""
    df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    numeric = df.select_dtypes(include=[np.number])
    all_nan_cols = numeric.columns[numeric.isna().all()].tolist()
    assert not all_nan_cols, f"These columns are 100% NaN (likely a bug): {all_nan_cols}"


def test_saved_model_roundtrip():
    import joblib
    model_path = ARTIFACT_DIR / "final_ensemble.joblib"
    if not model_path.exists():
        if pytest:
            pytest.skip("Run modeling/train_final.py first")
        print("SKIP test_saved_model_roundtrip: run modeling/train_final.py first")
        return
    ensemble = joblib.load(model_path)
    df = pd.read_csv(ARTIFACT_DIR / "participant_features.csv")
    with open(ARTIFACT_DIR / "model_manifest.json") as f:
        import json
        manifest = json.load(f)
    X = df[manifest["feature_columns"]].to_numpy(dtype=float)
    proba = ensemble.predict_proba(X)
    assert proba.shape == (len(df), 3)
    assert np.allclose(proba.sum(axis=1), 1.0, atol=1e-6)


if __name__ == "__main__":
    if pytest:
        sys.exit(pytest.main([__file__, "-v"]))
    # manual fallback runner for environments without pytest installed
    fns = [v for k, v in list(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {fn.__name__} -> {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
