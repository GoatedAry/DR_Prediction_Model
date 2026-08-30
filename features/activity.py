"""
Heart rate / activity features (PRD §22), including post-meal activity's
relationship to postprandial glucose response.
"""
import numpy as np
import pandas as pd


def build_activity_feature_vector(cleaned_df: pd.DataFrame) -> dict:
    """NOTE: the CGMacros 'METs' column is documented (DataDictionary.pdf) as
    the Fitbit Sense MET estimate multiplied by 10, so we divide by 10 here
    to get true METs before applying any physiologically meaningful
    threshold (e.g. MET >= 3 for light-or-above activity)."""
    d = cleaned_df.copy()
    if "METs" in d.columns:
        d["METs"] = d["METs"] / 10.0
    feats = {}

    hr = d["HR"].dropna() if "HR" in d.columns else pd.Series(dtype=float)
    feats["hr_mean"] = hr.mean() if len(hr) else np.nan
    feats["hr_sd"] = hr.std(ddof=1) if len(hr) > 1 else np.nan
    # resting/low-activity HR proxy: HR values in the lowest activity decile
    if "METs" in d.columns and "HR" in d.columns:
        low_act = d[d["METs"] <= d["METs"].quantile(0.1)]["HR"].dropna()
        feats["resting_hr_proxy"] = low_act.mean() if len(low_act) else np.nan
    else:
        feats["resting_hr_proxy"] = np.nan

    cal = d["Calories (Activity)"].dropna() if "Calories (Activity)" in d.columns else pd.Series(dtype=float)
    feats["activity_calories_mean_per_min"] = cal.mean() if len(cal) else np.nan
    feats["activity_calories_total"] = cal.sum() if len(cal) else np.nan

    mets = d["METs"].dropna() if "METs" in d.columns else pd.Series(dtype=float)
    feats["mets_mean"] = mets.mean() if len(mets) else np.nan
    feats["mets_sd"] = mets.std(ddof=1) if len(mets) > 1 else np.nan
    # crude "active minutes" proxy: MET >= 3 (light activity or above)
    feats["active_minutes_per_day"] = (
        (mets >= 3).sum() / max((d["Timestamp"].max() - d["Timestamp"].min()).days, 1)
        if len(mets) else np.nan
    )
    return feats


def build_post_meal_activity_features(cleaned_df: pd.DataFrame, window_min: int = 120) -> dict:
    """Average activity level in the window following each meal — used to
    contextualize postprandial glucose response (PRD §22)."""
    d = cleaned_df.copy()
    d["Timestamp"] = pd.to_datetime(d["Timestamp"])
    meals = d.dropna(subset=["Meal Type"])
    if meals.empty or "METs" not in d.columns:
        return {"post_meal_mets_mean": np.nan, "post_meal_active_frac": np.nan}

    mets_series = d.set_index("Timestamp")["METs"] / 10.0  # see note above
    vals = []
    for t in meals["Timestamp"]:
        w = mets_series.loc[t: t + pd.Timedelta(minutes=window_min)].dropna()
        if len(w):
            vals.append(w.mean())
    if not vals:
        return {"post_meal_mets_mean": np.nan, "post_meal_active_frac": np.nan}
    vals = pd.Series(vals)
    return {
        "post_meal_mets_mean": vals.mean(),
        "post_meal_active_frac": (vals >= 3).mean(),
    }
