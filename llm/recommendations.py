"""
Recommendation engine (PRD §41-42): the LLM is NOT allowed to invent medical
recommendations from raw data. It only converts these rule-engine outputs
into natural language. Rules fire on the already-computed feature vector +
model output, not on raw CGM.

Every rule is phrased as: recommend discussing / considering X with a
qualified professional. None of these are prescriptive dosing, diagnosis,
or treatment instructions.
"""
from dataclasses import dataclass


@dataclass
class RecommendationCandidate:
    category: str
    condition_met: bool
    recommendation: str
    reason: str


def generate_recommendation_candidates(features: dict, model_output: dict) -> list[RecommendationCandidate]:
    candidates = []

    high_excursions = (features.get("meal_avg_postprandial_excursion") or 0) > 40
    high_cv = (features.get("glc_cv") or 0) > 36  # ADA/international consensus CV threshold for "unstable"
    low_activity = (features.get("active_minutes_per_day") or 999) < 20
    high_post_meal_glucose = high_excursions
    low_tir = (features.get("glc_time_in_range") or 100) < 70
    elevated_overnight = (features.get("glc_overnight_mean") or 0) > 125
    prediabetic_or_t2d = model_output.get("prediabetes_probability", 0) + model_output.get("t2d_probability", 0) > 0.5

    candidates.append(RecommendationCandidate(
        category="meal_composition",
        condition_met=high_excursions and prediabetic_or_t2d,
        recommendation=("Consider discussing meal composition, portion size, and "
                         "carbohydrate pacing with a registered dietitian or clinician."),
        reason="Elevated average postprandial glucose excursions were observed across logged meals.",
    ))

    candidates.append(RecommendationCandidate(
        category="physical_activity",
        condition_met=low_activity and high_post_meal_glucose,
        recommendation=("Consider discussing appropriate post-meal physical activity "
                         "(e.g. a short walk) with a clinician, subject to individual medical suitability."),
        reason="Lower daily activity was observed alongside elevated post-meal glucose responses.",
    ))

    candidates.append(RecommendationCandidate(
        category="glycemic_variability",
        condition_met=high_cv,
        recommendation=("Consider discussing glucose variability patterns with a clinician; "
                         "sources can include meal timing, sleep, stress, or activity."),
        reason="Glucose coefficient of variation was above typical stability thresholds.",
    ))

    candidates.append(RecommendationCandidate(
        category="time_in_range",
        condition_met=low_tir,
        recommendation="Consider discussing overall glycemic control with a clinician.",
        reason="Time spent in the target glucose range was below typical clinical targets.",
    ))

    candidates.append(RecommendationCandidate(
        category="overnight_glucose",
        condition_met=elevated_overnight,
        recommendation="Consider discussing overnight/fasting glucose patterns with a clinician.",
        reason="Overnight mean glucose was elevated relative to typical fasting targets.",
    ))

    candidates.append(RecommendationCandidate(
        category="clinical_followup",
        condition_met=prediabetic_or_t2d,
        recommendation=("Discuss these results and appropriate confirmatory clinical testing "
                         "(e.g. HbA1c, oral glucose tolerance test) with a healthcare provider."),
        reason="Model-estimated risk of Pre-T2D/T2D exceeds 50%.",
    ))

    return [c for c in candidates if c.condition_met]
