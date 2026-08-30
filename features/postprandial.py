"""
Postprandial glucose analysis and meal-response features (PRD §19-21).

For each logged meal (Meal Type is non-null in the CGMacros export), we
look at the glucose trajectory in the following POSTPRANDIAL_WINDOW_MIN
minutes and derive per-meal response features, then aggregate them to
participant-level summaries. Meals that overlap a following meal within
POSTPRANDIAL_MEAL_SEPARATION_MIN are excluded from clean single-meal
analysis (their response would be confounded) — this is documented rather
than silently mixed in.
"""
import numpy as np
import pandas as pd

from config.config import (
    POSTPRANDIAL_WINDOW_MIN,
    POSTPRANDIAL_CHECKPOINTS_MIN,
    POSTPRANDIAL_MEAL_SEPARATION_MIN,
)


def _glucose_at_offset(g: pd.Series, meal_time, offset_min: int, tol_min: int = 5):
    """Nearest available glucose reading within tol_min of meal_time+offset."""
    target = meal_time + pd.Timedelta(minutes=offset_min)
    window = g.loc[target - pd.Timedelta(minutes=tol_min): target + pd.Timedelta(minutes=tol_min)]
    if window.empty:
        return np.nan
    deltas = np.abs((window.index - target).total_seconds())
    idx = int(np.argmin(deltas))
    return window.iloc[idx]


def extract_meal_events(cleaned_df: pd.DataFrame) -> pd.DataFrame:
    meals = cleaned_df.dropna(subset=["Meal Type"]).copy()
    meals["Timestamp"] = pd.to_datetime(meals["Timestamp"])
    return meals.sort_values("Timestamp")


def single_meal_response(g: pd.Series, meal_time, carbs, calories, protein, fat, fiber,
                          amount_consumed) -> dict:
    pre = _glucose_at_offset(g, meal_time, 0, tol_min=10)
    checkpoints = {f"g_{m}min": _glucose_at_offset(g, meal_time, m) for m in POSTPRANDIAL_CHECKPOINTS_MIN}

    window = g.loc[meal_time: meal_time + pd.Timedelta(minutes=POSTPRANDIAL_WINDOW_MIN)].dropna()
    if window.empty or pd.isna(pre):
        peak = np.nan
        time_to_peak = np.nan
        delta = np.nan
        auc = np.nan
        iauc = np.nan
        recovery_min = np.nan
    else:
        peak = window.max()
        peak_time = window.idxmax()
        time_to_peak = (peak_time - meal_time).total_seconds() / 60
        delta = peak - pre
        # trapezoidal AUC over the raw values (mg/dL * min)
        t_min = (window.index - meal_time).total_seconds().to_numpy() / 60
        auc = np.trapezoid(window.to_numpy(), t_min)
        iauc = np.trapezoid(np.clip(window.to_numpy() - pre, a_min=0, a_max=None), t_min)
        # recovery: first time after peak glucose returns to within 10% of pre
        post_peak = window.loc[peak_time:]
        recovered = post_peak[post_peak <= pre * 1.10]
        recovery_min = ((recovered.index[0] - peak_time).total_seconds() / 60
                         if len(recovered) else np.nan)

    resp = dict(
        meal_time=meal_time, pre_meal_glucose=pre, peak_glucose=peak,
        time_to_peak_min=time_to_peak, delta_glucose=delta, glucose_auc=auc,
        incremental_auc=iauc, recovery_time_min=recovery_min,
        carbs=carbs, calories=calories, protein=protein, fat=fat, fiber=fiber,
        amount_consumed=amount_consumed,
    )
    resp.update(checkpoints)
    # observed glycemic response, explicitly NOT framed as insulin sensitivity
    resp["observed_glycemic_response_per_carb"] = (
        delta / carbs if (carbs and carbs > 0 and pd.notna(delta)) else np.nan
    )
    return resp


def participant_meal_responses(cleaned_df: pd.DataFrame, glucose_col: str = "Libre GL") -> pd.DataFrame:
    g = cleaned_df.set_index("Timestamp")[glucose_col]
    meals = extract_meal_events(cleaned_df)
    if meals.empty:
        return pd.DataFrame()

    times = meals["Timestamp"].tolist()
    rows = []
    for i, row in meals.reset_index(drop=True).iterrows():
        t = row["Timestamp"]
        # exclude meals that overlap the following meal too closely
        if i + 1 < len(times) and (times[i + 1] - t).total_seconds() / 60 < POSTPRANDIAL_MEAL_SEPARATION_MIN:
            continue
        rows.append(single_meal_response(
            g, t, row.get("Carbs"), row.get("Calories"), row.get("Protein"),
            row.get("Fat"), row.get("Fiber"), row.get("Amount Consumed"),
        ))
    return pd.DataFrame(rows)


def build_postprandial_feature_vector(cleaned_df: pd.DataFrame, glucose_col: str = "Libre GL") -> dict:
    resp = participant_meal_responses(cleaned_df, glucose_col)
    if resp.empty:
        return {
            "meal_n_clean_events": 0,
            "meal_avg_postprandial_excursion": np.nan,
            "meal_max_postprandial_excursion": np.nan,
            "meal_avg_time_to_peak_min": np.nan,
            "meal_avg_recovery_time_min": np.nan,
            "meal_avg_iauc": np.nan,
            "meal_avg_response_per_carb": np.nan,
            "meal_response_variability": np.nan,
        }
    return {
        "meal_n_clean_events": len(resp),
        "meal_avg_postprandial_excursion": resp["delta_glucose"].mean(),
        "meal_max_postprandial_excursion": resp["delta_glucose"].max(),
        "meal_avg_time_to_peak_min": resp["time_to_peak_min"].mean(),
        "meal_avg_recovery_time_min": resp["recovery_time_min"].mean(),
        "meal_avg_iauc": resp["incremental_auc"].mean(),
        "meal_avg_response_per_carb": resp["observed_glycemic_response_per_carb"].mean(),
        "meal_response_variability": resp["delta_glucose"].std(ddof=1) if len(resp) > 1 else np.nan,
    }
