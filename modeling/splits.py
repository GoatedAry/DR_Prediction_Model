"""
Participant-level splitting (PRD §5, §34).

Every split here operates on participant_id as the *group* — never on rows —
because CGMacros has ~45 participants but thousands of temporal rows each.
Our dataset is already one-row-per-participant (features are pre-aggregated),
so "group" and "row" coincide by construction, but we keep the explicit
group-based API so this code is correct even if row-level temporal modeling
is added later (PRD §27 experimental TCN path).
"""
import numpy as np
from sklearn.model_selection import StratifiedGroupKFold, LeaveOneGroupOut

from config.config import N_CV_FOLDS, RANDOM_SEED


def stratified_group_kfold_splits(X, y, groups, n_splits=N_CV_FOLDS, seed=RANDOM_SEED):
    """Yields (train_idx, val_idx) with no participant appearing in both."""
    skf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    for train_idx, val_idx in skf.split(X, y, groups):
        assert set(np.array(groups)[train_idx]).isdisjoint(set(np.array(groups)[val_idx])), \
            "Participant leakage detected between train/val!"
        yield train_idx, val_idx


def leave_one_participant_out_splits(X, groups):
    logo = LeaveOneGroupOut()
    for train_idx, val_idx in logo.split(X, groups=groups):
        yield train_idx, val_idx
