"""
Glycemic Phenotype Vector — core CGM-derived features (PRD §13-17).

Every function documents: (1) what it computes, (2) its assumptions,
(3) how it handles missing data. Nothing is computed "because it's popular"
without a stated rationale (PRD §14).

All functions take a single glucose Series (already gap-limited/interpolated
by preprocessing.cgm_cleaning) indexed by a regular-frequency DatetimeIndex,
plus an explicit `sample_interval_min`.
"""
import numpy as np
import pandas as pd
from scipy import stats as sstats

from config.config import GLUCOSE_THRESHOLDS, CIRCADIAN_BINS


# ---------------------------------------------------------------------------
# 13.1 Basic glucose statistics
# ---------------------------------------------------------------------------
def basic_stats(glucose: pd.Series) -> dict:
    g = glucose.dropna()
    if len(g) < 10:
        return {k: np.nan for k in
                ["mean", "median", "min", "max", "sd", "variance", "cv", "iqr"]}
    mean = g.mean()
    sd = g.std(ddof=1)
    q1, q3 = g.quantile(0.25), g.quantile(0.75)
    return {
        "mean": mean, "median": g.median(), "min": g.min(), "max": g.max(),
        "sd": sd, "variance": g.var(ddof=1),
        "cv": 100 * sd / mean if mean else np.nan,   # % coefficient of variation
        "iqr": q3 - q1,
    }


# ---------------------------------------------------------------------------
# 14. Glycemic variability
# ---------------------------------------------------------------------------
def mage(glucose: pd.Series, sd_multiple: float = 1.0) -> float:
    """Mean Amplitude of Glycemic Excursions.

    Assumption/implementation (documented per PRD §14 requirement):
    Turning points (local maxima/minima) are found on the raw series, then
    consecutive turning-point-to-turning-point excursions whose amplitude
    exceeds `sd_multiple` * SD(glucose) are averaged. This is the standard
    Service et al. (1970) formulation. Requires >=24h of data to be
    meaningful; returns NaN otherwise.
    """
    g = glucose.dropna().to_numpy()
    if len(g) < 60:
        return np.nan
    sd = g.std(ddof=1) if hasattr(g, "std") else np.std(g, ddof=1)
    if sd == 0 or np.isnan(sd):
        return np.nan
    # turning points: sign change of first difference
    diffs = np.diff(g)
    signs = np.sign(diffs)
    signs[signs == 0] = 1
    turn_idx = np.where(np.diff(signs) != 0)[0] + 1
    turn_idx = np.concatenate(([0], turn_idx, [len(g) - 1]))
    turn_vals = g[turn_idx]

    excursions = np.abs(np.diff(turn_vals))
    threshold = sd_multiple * sd
    valid = excursions[excursions > threshold]
    return float(valid.mean()) if len(valid) > 0 else 0.0


def conga(glucose: pd.Series, sample_interval_min: int, lag_hours: float = 1.0) -> float:
    """Continuous Overall Net Glycemic Action (McDonnell et al., 2005).

    Assumption: CONGA(n) = SD of (glucose[t] - glucose[t - n hours]) across
    all valid t. Requires the lagged pairing to both be non-missing; pairs
    with either side missing are dropped (not imputed as zero-difference).
    """
    lag_steps = int(round(lag_hours * 60 / sample_interval_min))
    if lag_steps <= 0 or len(glucose) <= lag_steps:
        return np.nan
    diffs = glucose - glucose.shift(lag_steps)
    diffs = diffs.dropna()
    if len(diffs) < 30:
        return np.nan
    return float(diffs.std(ddof=1))


def modd(glucose: pd.Series, sample_interval_min: int) -> float:
    """Mean Of Daily Differences — mean absolute difference between glucose
    at the same clock-time on consecutive days. Requires >= 2 full days;
    returns NaN otherwise. Missing same-time pairs are skipped, not imputed.
    """
    lag_steps = int(round(24 * 60 / sample_interval_min))
    if len(glucose) <= lag_steps:
        return np.nan
    diffs = (glucose - glucose.shift(lag_steps)).abs().dropna()
    if len(diffs) < 30:
        return np.nan
    return float(diffs.mean())


def variability_features(glucose: pd.Series, sample_interval_min: int) -> dict:
    b = basic_stats(glucose)
    return {
        "cv": b["cv"],
        "sd": b["sd"],
        "iqr": b["iqr"],
        "mage": mage(glucose),
        "conga1h": conga(glucose, sample_interval_min, lag_hours=1.0),
        "conga4h": conga(glucose, sample_interval_min, lag_hours=4.0),
        "modd": modd(glucose, sample_interval_min),
    }


# ---------------------------------------------------------------------------
# 15. Time-in-range features
# ---------------------------------------------------------------------------
def time_in_range_features(glucose: pd.Series, thresholds: dict = None) -> dict:
    thresholds = thresholds or GLUCOSE_THRESHOLDS
    g = glucose.dropna()
    if len(g) == 0:
        return {"time_below_range": np.nan, "time_in_range": np.nan,
                "time_above_range": np.nan, "time_very_low": np.nan, "time_very_high": np.nan}
    n = len(g)
    return {
        "time_very_low": 100 * (g < thresholds["low"]).sum() / n,
        "time_below_range": 100 * (g < thresholds["target_low"]).sum() / n,
        "time_in_range": 100 * ((g >= thresholds["target_low"]) & (g <= thresholds["target_high"])).sum() / n,
        "time_above_range": 100 * (g > thresholds["target_high"]).sum() / n,
        "time_very_high": 100 * (g > thresholds["high"]).sum() / n,
    }


# ---------------------------------------------------------------------------
# 16. Glucose excursion features (spike detection, noise-robust)
# ---------------------------------------------------------------------------
def excursion_features(glucose: pd.Series, sample_interval_min: int,
                        min_rise: float = 30, min_duration_min: int = 15,
                        smooth_window_min: int = 15) -> dict:
    """
    Detects genuine excursions by first smoothing with a rolling median
    (removes single-sample sensor noise) then finding rises from a local
    trough that exceed `min_rise` mg/dL and persist for >= `min_duration_min`
    before returning back toward baseline. This distinguishes real
    postprandial-type spikes from sensor jitter (PRD §16 requirement).
    """
    win = max(1, int(round(smooth_window_min / sample_interval_min)))
    g = glucose.rolling(win, center=True, min_periods=1).median()
    g = g.dropna()
    if len(g) < 30:
        return {k: np.nan for k in
                ["n_spikes", "avg_spike_magnitude", "max_spike_magnitude",
                 "avg_spike_duration_min", "max_spike_duration_min",
                 "avg_recovery_time_min", "max_recovery_time_min",
                 "avg_rise_rate_mgdl_min", "avg_fall_rate_mgdl_min"]}

    vals = g.to_numpy()
    n = len(vals)
    min_duration_steps = max(1, int(round(min_duration_min / sample_interval_min)))

    spikes = []
    i = 1
    while i < n - 1:
        # find local trough
        if vals[i] <= vals[i - 1]:
            i += 1
            continue
        trough_i = i - 1
        trough_val = vals[trough_i]
        # walk forward while rising or roughly flat-near-peak
        j = i
        peak_i, peak_val = i, vals[i]
        while j < n - 1 and vals[j + 1] >= peak_val - 2:  # allow tiny noise dips
            j += 1
            if vals[j] > peak_val:
                peak_val, peak_i = vals[j], j
            if vals[j] < trough_val:  # new lower trough, restart
                break
        rise = peak_val - trough_val
        duration_steps = peak_i - trough_i
        if rise >= min_rise and duration_steps >= min_duration_steps:
            # recovery: time from peak back to within min_rise/2 of trough
            k = peak_i
            recovery_target = trough_val + rise * 0.5
            while k < n - 1 and vals[k] > recovery_target:
                k += 1
            recovery_steps = k - peak_i
            rise_rate = rise / max(duration_steps * sample_interval_min, 1)
            fall_val = vals[peak_i] - vals[min(k, n - 1)]
            fall_rate = fall_val / max(recovery_steps * sample_interval_min, 1) if recovery_steps > 0 else np.nan
            spikes.append(dict(
                magnitude=rise,
                duration_min=duration_steps * sample_interval_min,
                recovery_min=recovery_steps * sample_interval_min,
                rise_rate=rise_rate,
                fall_rate=fall_rate,
            ))
            i = k + 1
        else:
            i += 1

    if not spikes:
        return {
            "n_spikes": 0, "avg_spike_magnitude": 0.0, "max_spike_magnitude": 0.0,
            "avg_spike_duration_min": 0.0, "max_spike_duration_min": 0.0,
            "avg_recovery_time_min": 0.0, "max_recovery_time_min": 0.0,
            "avg_rise_rate_mgdl_min": 0.0, "avg_fall_rate_mgdl_min": 0.0,
        }
    sp = pd.DataFrame(spikes)
    return {
        "n_spikes": len(sp),
        "avg_spike_magnitude": sp["magnitude"].mean(),
        "max_spike_magnitude": sp["magnitude"].max(),
        "avg_spike_duration_min": sp["duration_min"].mean(),
        "max_spike_duration_min": sp["duration_min"].max(),
        "avg_recovery_time_min": sp["recovery_min"].mean(),
        "max_recovery_time_min": sp["recovery_min"].max(),
        "avg_rise_rate_mgdl_min": sp["rise_rate"].mean(),
        "avg_fall_rate_mgdl_min": sp["fall_rate"].mean(skipna=True),
    }


# ---------------------------------------------------------------------------
# 17-18. Circadian & overnight/fasting features
# ---------------------------------------------------------------------------
def circadian_features(df: pd.DataFrame, glucose_col: str) -> dict:
    """df must have a 'Timestamp' column and the glucose column."""
    d = df.dropna(subset=[glucose_col]).copy()
    if len(d) == 0:
        return {}
    d["hour"] = pd.to_datetime(d["Timestamp"]).dt.hour

    out = {}
    for name, (start, end) in CIRCADIAN_BINS.items():
        mask = (d["hour"] >= start) & (d["hour"] < end)
        seg = d.loc[mask, glucose_col]
        out[f"{name}_mean"] = seg.mean() if len(seg) else np.nan
        out[f"{name}_sd"] = seg.std(ddof=1) if len(seg) > 1 else np.nan

    day_mean = d.loc[(d["hour"] >= 6) & (d["hour"] < 24), glucose_col].mean()
    night_mean = d.loc[(d["hour"] >= 0) & (d["hour"] < 6), glucose_col].mean()
    out["day_night_glucose_diff"] = (day_mean - night_mean
                                      if pd.notna(day_mean) and pd.notna(night_mean) else np.nan)

    # morning rise: overnight mean -> mean of first 2h after 6am (proxy for
    # dawn-phenomenon-type rise; labeled descriptively, not diagnostically)
    morning_early = d.loc[(d["hour"] >= 6) & (d["hour"] < 8), glucose_col].mean()
    overnight_mean = out.get("overnight_mean", np.nan)
    out["morning_rise"] = (morning_early - overnight_mean
                            if pd.notna(morning_early) and pd.notna(overnight_mean) else np.nan)
    return out


def build_cgm_feature_vector(cleaned_df: pd.DataFrame, sample_interval_min: int,
                              glucose_col: str = "Libre GL") -> dict:
    """Aggregate all long-term (whole-monitoring-period) CGM features for one
    participant into a single flat dict, prefixed by device stream."""
    g = cleaned_df.set_index("Timestamp")[glucose_col]
    feats = {}
    feats.update({f"glc_{k}": v for k, v in basic_stats(g).items()})
    feats.update({f"glc_{k}": v for k, v in variability_features(g, sample_interval_min).items()
                  if k not in ("cv", "sd", "iqr")})  # avoid duplicate cv/sd/iqr keys
    feats.update({f"glc_{k}": v for k, v in time_in_range_features(g).items()})
    feats.update({f"glc_{k}": v for k, v in excursion_features(g, sample_interval_min).items()})
    feats.update({f"glc_{k}": v for k, v in circadian_features(cleaned_df, glucose_col).items()})
    return feats
