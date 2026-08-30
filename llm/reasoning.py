"""
Orchestrates the LLM reasoning layer:

    ML feature vector + probabilities + SHAP/permutation importances
    -> LLMInputSchema (validated)
    -> prompt
    -> Groq API call, forced to return JSON
    -> ReasoningOutput (validated)
    -> if validation fails: retry once, then fall back to a deterministic
       template response (never show the user unvalidated/malformed output)

This sandbox has no internet access and no API key configured, so
`call_llm()` cannot actually reach the Groq API here. `explain()` below
demonstrates the full flow using `template_fallback()` in place of a live
call, clearly marked, so the orchestration logic itself is exercised and
testable. Swap `USE_LIVE_LLM = True` (and set GROQ_API_KEY) in a real
deployment -- no other code changes needed.

Uses Groq's OpenAI-compatible chat completions API with JSON object mode
(https://console.groq.com/docs/structured-outputs). Default model is
llama-3.3-70b-versatile; swap MODEL below for openai/gpt-oss-120b if you
want Groq's strict json_schema mode instead (see call_llm's comment).
"""
import json
import os

from llm.prompts import SYSTEM_PROMPT, build_user_prompt
from llm.recommendations import generate_recommendation_candidates
from config.config import CLASS_NAMES

USE_LIVE_LLM = True  # flip to True once run outside this offline sandbox
MODEL = "openai/gpt-oss-120b"
MAX_RETRIES = 2  # 1 initial attempt + 1 retry before falling back to template


def build_llm_input(participant_id, features: dict, model_probabilities: dict,
                     important_features: list, mode: str = "full_multimodal") -> dict:
    dq = {
        "score": features.get("data_quality_score"),
        "missing_cgm_percentage": round(100 * (1 - features.get("cgm_coverage_fraction", 1)), 2),
        "valid_cgm_hours": features.get("valid_cgm_hours"),
        "meets_min_duration": bool(features.get("meets_min_cgm_duration", True)),
        "limitations": ([] if features.get("meets_min_cgm_duration", True) else
                         ["Insufficient valid CGM duration for reliable long-term pattern assessment."]),
    }
    return {
        "participant_id": participant_id,
        "mode": mode,
        "patient": {"age": features.get("age"), "gender": features.get("gender_male"),
                    "bmi": features.get("bmi")},
        "clinical": {"hba1c": features.get("hba1c"), "fasting_glucose": features.get("fasting_glucose"),
                     "fasting_insulin": features.get("fasting_insulin"),
                     "triglycerides": features.get("triglycerides"), "hdl": features.get("hdl"),
                     "ldl": features.get("ldl")},
        "glycemic_profile": {
            "mean_glucose": features.get("glc_mean"), "glucose_cv": features.get("glc_cv"),
            "time_in_range": features.get("glc_time_in_range"),
            "time_above_range": features.get("glc_time_above_range"),
            "time_below_range": features.get("glc_time_below_range"),
            "overnight_mean": features.get("glc_overnight_mean"),
            "average_postprandial_excursion": features.get("meal_avg_postprandial_excursion"),
            "maximum_postprandial_excursion": features.get("meal_max_postprandial_excursion"),
            "average_recovery_time_min": features.get("meal_avg_recovery_time_min"),
        },
        "activity": {"mean_hr": features.get("hr_mean"),
                     "active_minutes_per_day": features.get("active_minutes_per_day"),
                     "post_meal_active_frac": features.get("post_meal_active_frac")},
        "model_output": model_probabilities,
        "important_features": important_features,
        "data_quality": dq,
    }


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Real API call -- requires `pip install groq` and GROQ_API_KEY.
    Not executed in this offline sandbox (USE_LIVE_LLM is False).

    Uses basic JSON object mode (response_format={"type": "json_object"}),
    supported by all Groq chat models -- this only guarantees syntactically
    valid JSON, not schema conformance, which is why explain() below still
    validates the parsed result and retries/falls back on failure. If you
    switch MODEL to "openai/gpt-oss-120b" or "openai/gpt-oss-20b", you can
    instead pass response_format={"type": "json_schema", "json_schema": {...}}
    with strict=True for guaranteed schema-conformant output -- see
    https://console.groq.com/docs/structured-outputs.
    """
    from groq import Groq
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Set it as an environment variable "
            "(e.g. `$env:GROQ_API_KEY = \"...\"` in PowerShell) or fall back "
            "will be used instead."
        )
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=MODEL,
        max_completion_tokens=2500,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return resp.choices[0].message.content


def template_fallback(llm_input: dict, candidates: list) -> dict:
    """Deterministic, template-based response used when the LLM is
    unavailable or returns invalid output. Grounded in exactly the same
    structured data an LLM would receive -- no fabricated content."""
    probs = llm_input["model_output"]
    label = max(["healthy_probability", "prediabetes_probability", "t2d_probability"],
                key=lambda k: probs[k])
    label_map = {"healthy_probability": "Healthy", "prediabetes_probability": "Pre-T2D",
                 "t2d_probability": "T2D"}
    top_feats = llm_input["important_features"][:3]
    patterns = []
    gp = llm_input.get("glycemic_profile") or {}
    if (gp.get("average_postprandial_excursion") or 0) > 40:
        patterns.append("Elevated average post-meal glucose excursions were observed.")
    if (gp.get("glucose_cv") or 0) > 36:
        patterns.append("Glucose variability (CV) is above typical stability thresholds.")
    if (gp.get("time_in_range") or 100) < 70:
        patterns.append("Time spent within the target glucose range is below typical clinical targets.")
    if not patterns:
        patterns.append("No strongly abnormal glycemic patterns were flagged in the computed features.")

    return {
        "classification": {"label": label_map[label], "probability": round(probs[label], 3)},
        "summary": (f"Based on the available clinical and glycemic data, the model's "
                    f"estimated state is {label_map[label]} "
                    f"({round(probs[label] * 100)}% model confidence)."),
        "glycemic_patterns": patterns,
        "major_contributing_factors": [
            {"factor": f["feature"], "importance": "high" if i == 0 else "moderate",
             "explanation": f"This was {'the strongest' if i == 0 else 'a notable'} "
                             f"influence on the model's prediction (direction: {f['direction']})."}
            for i, f in enumerate(top_feats)
        ],
        "recommendations": [
            {"category": c.category, "recommendation": c.recommendation, "reason": c.reason}
            for c in candidates
        ],
        "data_quality": {"score": llm_input["data_quality"]["score"],
                          "limitations": llm_input["data_quality"]["limitations"]},
        "safety_message": ("This is an AI-assisted metabolic risk screening estimate, not a "
                            "clinical diagnosis. Please discuss these results with a qualified "
                            "healthcare provider, particularly if risk is elevated or results are uncertain."),
    }


def _validate(parsed: dict) -> dict:
    """Validates against llm.schemas.ReasoningOutput if pydantic is
    installed; otherwise does a minimal structural check so this still
    guards against obviously malformed output."""
    try:
        from llm.schemas import ReasoningOutput
        return ReasoningOutput.model_validate(parsed).model_dump()
    except ImportError:
        required = {"classification", "summary", "major_contributing_factors",
                    "recommendations", "data_quality", "safety_message"}
        if not required.issubset(parsed.keys()):
            raise ValueError(f"Missing required keys: {required - parsed.keys()}")
        return parsed


def explain(participant_id, features: dict, model_probabilities: dict, important_features: list) -> dict:
    llm_input = build_llm_input(participant_id, features, model_probabilities, important_features)
    candidates = generate_recommendation_candidates(features, model_probabilities)

    if USE_LIVE_LLM:
        user_prompt = build_user_prompt(llm_input, candidates)
        for attempt in range(MAX_RETRIES):
            try:
                raw = call_llm(SYSTEM_PROMPT, user_prompt)
                parsed = json.loads(raw)
                return _validate(parsed)
            except Exception as e:
                # Catches missing API key (RuntimeError), malformed JSON
                # (json.JSONDecodeError), failed schema validation
                # (ValueError), and any Groq API/network errors -- the
                # design intent here is "never crash, always fall back
                # to the deterministic template" rather than surfacing
                # a raw exception to the caller.
                if attempt == MAX_RETRIES - 1:
                    break  # fall through to template fallback
                continue  # retry once
        # both attempts failed -- never show the user unvalidated output

    return template_fallback(llm_input, candidates)
