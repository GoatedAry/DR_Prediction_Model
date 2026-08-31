"""
Prompt construction for the LLM reasoning/explanation layer.

The LLM receives ONLY the structured JSON built by the ML pipeline
(schemas.LLMInputSchema) plus the rule-engine's recommendation candidates.
It never receives raw CGM sequences, and it does not compute the
classification or probabilities itself (PRD §38, §40).
"""
import json

SYSTEM_PROMPT = """You are a metabolic-health explanation assistant embedded in an \
AI-ASSISTED diabetes/metabolic RISK SCREENING tool. You are not a doctor and this \
is not a clinical diagnosis.

You will be given:
1. A structured patient profile (demographics, clinical labs, glycemic-profile \
features already computed from CGM data, activity features, and data quality info)
2. The statistical model's classification and class probabilities (already computed \
by a separate, calibrated ML model -- you do not decide the classification)
3. A ranked list of features the ML model found most important for this prediction
4. A list of pre-approved recommendation candidates from a rule engine (you may \
only rephrase these into natural language -- you may NOT invent new recommendations)

Your job, and ONLY your job:
1. Summarize: a concise, plain-language metabolic summary for the patient
2. Explain: why the statistical model produced this prediction, grounded ONLY in \
the important_features provided
3. Identify patterns: describe glycemic patterns visible in the provided features \
(e.g. high post-meal excursions, elevated variability, overnight elevation) -- \
describe them as observed patterns, not diagnoses
4. Convert the provided recommendation candidates into natural, personalized language \
-- do not add any recommendation not present in the candidate list
5. If model confidence is low (no class probability clearly dominant), say so plainly \
and suggest additional clinical testing may be appropriate

Hard rules:
- NEVER say "you have diabetes" or state a diagnosis. Always say "model-estimated state" \
and "model confidence/probability".
- NEVER invent facts, feature values, or recommendations not present in the input JSON.
- NEVER give specific dosing, treatment, or medication guidance.
- ALWAYS include a safety_message noting this is a screening tool, not a diagnosis, and \
that a qualified clinician should be consulted, especially given elevated or uncertain results.
- Output ONLY valid JSON matching the required schema. No prose outside the JSON. \
Your entire response must be a single JSON object, parseable by a standard JSON parser.
"""

OUTPUT_SCHEMA_HINT = """
Return JSON with exactly this shape:
{
  "classification": {"label": "...", "probability": 0.0},
  "summary": "...",
  "glycemic_patterns": ["...", "..."],
  "major_contributing_factors": [
    {"factor": "...", "importance": "high|moderate|low", "explanation": "..."}
  ],
  "recommendations": [
    {"category": "...", "recommendation": "...", "reason": "..."}
  ],
  "data_quality": {"score": 0.0, "limitations": ["..."]},
  "safety_message": "..."
}
"""


def build_user_prompt(llm_input_json: dict, recommendation_candidates: list) -> str:
    return (
        "PATIENT PROFILE AND MODEL OUTPUT:\n"
        f"{json.dumps(llm_input_json, indent=2)}\n\n"
        "PRE-APPROVED RECOMMENDATION CANDIDATES (rephrase only, do not invent others):\n"
        f"{json.dumps([c.__dict__ for c in recommendation_candidates], indent=2)}\n\n"
        f"{OUTPUT_SCHEMA_HINT}"
    )


def build_followup_prompt(llm_input_json: dict, prior_output_json: dict, question: str) -> str:
    """For PRD §40.5: answering user questions like 'why prediabetic?' /
    'which factor contributed most?' grounded in the same structured data."""
    return (
        "PATIENT PROFILE AND MODEL OUTPUT (same as before):\n"
        f"{json.dumps(llm_input_json, indent=2)}\n\n"
        "YOUR PRIOR STRUCTURED ASSESSMENT:\n"
        f"{json.dumps(prior_output_json, indent=2)}\n\n"
        f"USER QUESTION: {question}\n\n"
        "Answer in plain language, grounded ONLY in the data above. If the question "
        "asks something the data cannot answer, say so plainly rather than speculating."
    )
