"""
Structured schemas for the LLM layer (PRD §39 input, §43 output).

Using pydantic means the LLM's structured output can be validated, not just
hoped-for — if the model returns malformed JSON, `ReasoningOutput.model_validate`
raises, and the caller can retry or fall back to a template response instead
of showing the user something ungrounded.
"""
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Input (built by the ML pipeline, never authored by the LLM)
# ---------------------------------------------------------------------------
class PatientDemographics(BaseModel):
    age: Optional[float] = None
    gender: Optional[str] = None
    bmi: Optional[float] = None


class ClinicalPanel(BaseModel):
    hba1c: Optional[float] = None
    fasting_glucose: Optional[float] = None
    fasting_insulin: Optional[float] = None
    triglycerides: Optional[float] = None
    hdl: Optional[float] = None
    ldl: Optional[float] = None


class GlycemicProfile(BaseModel):
    mean_glucose: Optional[float] = None
    glucose_cv: Optional[float] = None
    time_in_range: Optional[float] = None
    time_above_range: Optional[float] = None
    time_below_range: Optional[float] = None
    overnight_mean: Optional[float] = None
    average_postprandial_excursion: Optional[float] = None
    maximum_postprandial_excursion: Optional[float] = None
    average_recovery_time_min: Optional[float] = None


class ActivityProfile(BaseModel):
    mean_hr: Optional[float] = None
    active_minutes_per_day: Optional[float] = None
    post_meal_active_frac: Optional[float] = None


class ModelOutput(BaseModel):
    healthy_probability: float
    prediabetes_probability: float
    t2d_probability: float


class ImportantFeature(BaseModel):
    feature: str
    direction: str  # "increases_risk" | "decreases_risk" | "unclear"
    importance: float


class DataQuality(BaseModel):
    score: float
    missing_cgm_percentage: float
    valid_cgm_hours: float
    meets_min_duration: bool
    limitations: list[str] = Field(default_factory=list)


class LLMInputSchema(BaseModel):
    """The ONLY thing the LLM receives about a participant — structured,
    pre-computed, already-explained. Never raw CGM sequences (PRD §38)."""
    participant_id: Optional[int] = None
    mode: str  # "clinical_only" | "full_multimodal"
    patient: PatientDemographics
    clinical: ClinicalPanel
    glycemic_profile: Optional[GlycemicProfile] = None
    activity: Optional[ActivityProfile] = None
    model_output: ModelOutput
    important_features: list[ImportantFeature]
    data_quality: DataQuality


# ---------------------------------------------------------------------------
# Output (what the LLM must return; validated before showing to the user)
# ---------------------------------------------------------------------------
class Classification(BaseModel):
    label: str
    probability: float


class ContributingFactor(BaseModel):
    factor: str
    importance: str  # "high" | "moderate" | "low"
    explanation: str


class Recommendation(BaseModel):
    category: str
    recommendation: str
    reason: str


class DataQualityOut(BaseModel):
    score: float
    limitations: list[str] = Field(default_factory=list)


class ReasoningOutput(BaseModel):
    classification: Classification
    summary: str
    glycemic_patterns: list[str] = Field(default_factory=list)
    major_contributing_factors: list[ContributingFactor]
    recommendations: list[Recommendation]
    data_quality: DataQualityOut
    safety_message: str
