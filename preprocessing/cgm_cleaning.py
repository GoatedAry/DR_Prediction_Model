"""
CGM quality-control pipeline (PRD §33):

    Raw CGM -> timestamp validation -> duplicate removal -> sorting ->
    physiological plausibility check -> gap detection -> noise/outlier
    handling -> quality score -> (ready for feature extraction)

Each participant file also gets Libre/Dexcom kept as two separate streams
(PRD §6.1) — never blindly averaged.
"""
from dataclasses import dataclass
import numpy as np
import pandas as pd

from config.config import (
    MAX_INTERP_GAP_MIN,
    EXPECTED_SAMPLE_INTERVAL_MIN,
    MIN_VALID_HOURS_FOR_TEMPORAL_ASSESSMENT,
)

# Physiologically implausible CGM readings (device range is roughly 40-400 mg/dL)
PHYSIO_MIN = 39
PHYSIO_MAX = 400


@dataclass
class CleanedCGM:
    df: pd.DataFrame              # cleaned, minute-indexed dataframe
    quality_score: float          # 0-1 composite quality score
    quality_report: dict          # component-level detail for transparency
    valid_hours: float


def _dedupe_and_sort(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
    df = df.dropna(subset=["Timestamp"])
    df = df.sort_values("Timestamp")
    df = df.drop_duplicates(subset="Timestamp", keep="first")
    return df


def _plausibility_filter(df: pd.DataFrame, cols=("Libre GL", "Dexcom GL")) -> tuple[pd.DataFrame, dict]:
    """Mark physiologically impossible glucose readings as missing rather than
    silently keeping or dropping the whole row (PRD §32: missing != zero)."""
    report = {}
    df = df.copy()
    for col in cols:
        if col not in df.columns:
            continue
        n_before = df[col].notna().sum()
        bad = (df[col] < PHYSIO_MIN) | (df[col] > PHYSIO_MAX)
        df.loc[bad, col] = np.nan
        report[f"{col}_implausible_removed"] = int(bad.sum())
        report[f"{col}_n_valid_before"] = int(n_before)
    return df, report


def _interpolate_short_gaps(series: pd.Series, max_gap_min: int) -> pd.Series:
    """Linearly interpolate only gaps <= max_gap_min; longer gaps stay NaN
    (i.e. genuinely missing, not fabricated — PRD §19: 'do not fabricate
    observations')."""
    s = series.copy()
    is_na = s.isna()
    if not is_na.any():
        return s
    # identify runs of consecutive NaNs
    group = (is_na != is_na.shift()).cumsum()
    gap_lengths = is_na.groupby(group).transform("sum")
    fillable = is_na & (gap_lengths <= max_gap_min)
    s_interp = s.interpolate(method="linear", limit_area="inside")
    s.loc[fillable] = s_interp.loc[fillable]
    return s


def clean_participant_cgm(raw: pd.DataFrame, sample_interval_min: int = EXPECTED_SAMPLE_INTERVAL_MIN) -> CleanedCGM:
    df = _dedupe_and_sort(raw)
    df, plaus_report = _plausibility_filter(df)

    # Reindex to a regular 1-minute grid so gap detection is well-defined.
    full_idx = pd.date_range(df["Timestamp"].min(), df["Timestamp"].max(),
                              freq=f"{sample_interval_min}min")
    df = df.set_index("Timestamp").reindex(full_idx)
    df.index.name = "Timestamp"

    n_total = len(df)
    for col in ("Libre GL", "Dexcom GL"):
        if col in df.columns:
            df[col] = _interpolate_short_gaps(df[col], MAX_INTERP_GAP_MIN)

    # Prefer Libre as primary continuous stream (near-zero raw missingness in
    # this dataset); keep Dexcom alongside as a secondary/cross-check stream
    # (PRD §6.1 — both retained, never blindly averaged).
    libre_valid = df["Libre GL"].notna().sum() if "Libre GL" in df.columns else 0
    dexcom_valid = df["Dexcom GL"].notna().sum() if "Dexcom GL" in df.columns else 0

    valid_minutes = max(libre_valid, dexcom_valid)
    valid_hours = valid_minutes * sample_interval_min / 60.0

    coverage = valid_minutes / n_total if n_total else 0.0
    implausible_frac = (
        plaus_report.get("Libre GL_implausible_removed", 0)
        / max(plaus_report.get("Libre GL_n_valid_before", 1), 1)
    )
    duration_score = min(valid_hours / (24 * 7), 1.0)  # full credit at >=7 days
    quality_score = float(np.clip(
        0.5 * coverage + 0.3 * duration_score + 0.2 * (1 - min(implausible_frac, 1)),
        0, 1,
    ))

    report = {
        **plaus_report,
        "n_grid_minutes": n_total,
        "libre_valid_minutes": int(libre_valid),
        "dexcom_valid_minutes": int(dexcom_valid),
        "coverage_fraction": round(coverage, 4),
        "valid_hours": round(valid_hours, 2),
        "meets_min_duration": valid_hours >= MIN_VALID_HOURS_FOR_TEMPORAL_ASSESSMENT,
    }

    df = df.reset_index()
    return CleanedCGM(df=df, quality_score=round(quality_score, 4),
                       quality_report=report, valid_hours=round(valid_hours, 2))
